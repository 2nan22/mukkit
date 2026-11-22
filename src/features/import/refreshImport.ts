import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ImportError, type ImportedList, type PlaceSource, type PlaceSourceName } from "@/domain/importedPlace";
import type { ImportMode } from "./importMode";
import { saveImportedList } from "./saveImportedList";
import { placeSourceFor } from "./sources";

const NOTE_MAX = 300;
const LIST_NAME_MAX = 40;

export type ImportSourceKey = { source: PlaceSourceName; sourceListId: string; mode: ImportMode };
export type RefreshResult =
  | { status: "unchanged" }
  | { status: "updated"; added: number; removed: number; memos: number }
  | { status: "unavailable" | "error" };

// 원본 응답 요약 — 순서와 상관없이, 반영할 값만
export function hashList(list: ImportedList): string {
  const places = [...list.places]
    .sort((a, b) => a.sourcePlaceId.localeCompare(b.sourcePlaceId))
    .map((p) => [p.sourcePlaceId, p.name, p.memo, p.address, p.available, p.categoryName]);
  return createHash("sha256").update(JSON.stringify([list.name, list.memo, places])).digest("hex");
}

// 가져올 때 · 새로 고칠 때 기록 남기기
export async function recordImportSource(
  client: SupabaseClient,
  userId: string,
  list: ImportedList,
  mode: ImportMode,
): Promise<void> {
  await client.from("import_sources").upsert(
    {
      user_id: userId,
      source: list.source,
      source_list_id: list.sourceListId,
      mode: mode.kind,
      tier: mode.kind === "tier" ? mode.tier : null,
      list_name: list.name,
      last_hash: hashList(list),
      last_synced_at: new Date().toISOString(),
      status: "ok",
      fail_count: 0,
    },
    { onConflict: "user_id,source,source_list_id" },
  );
}

// 원본을 다시 읽어 반영 — 빠진 곳은 마이슐랭 리스트에서만 빼고(내 장소 · 등급 · 메모 · 사진은 그대로),
// 새 곳은 가져올 때 고른 방식대로 추가, 원본 메모는 내가 고치지 않은 것만 바꾼다
// updatePlaces: 장소 이름 · 주소 · 업종도 원본대로 (서비스 키로 도는 새벽 작업에서만)
export async function refreshImport(
  client: SupabaseClient,
  userId: string,
  key: ImportSourceKey,
  opts: { placeSource?: PlaceSource; updatePlaces?: boolean } = {},
): Promise<RefreshResult> {
  let list: ImportedList;
  try {
    list = await (opts.placeSource ?? placeSourceFor(key.source)).fetchList(key.sourceListId);
  } catch (e) {
    const unavailable = e instanceof ImportError && e.code === "LIST_NOT_FOUND_OR_PRIVATE";
    await markFailed(client, userId, key, unavailable ? "unavailable" : "error");
    return { status: unavailable ? "unavailable" : "error" };
  }

  const prev = await client
    .from("import_sources")
    .select("last_hash, list_name")
    .eq("user_id", userId)
    .eq("source", key.source)
    .eq("source_list_id", key.sourceListId)
    .maybeSingle();
  const hash = hashList(list);
  if (prev.data?.last_hash === hash) {
    await client
      .from("import_sources")
      .update({ last_synced_at: new Date().toISOString(), status: "ok", fail_count: 0 })
      .eq("user_id", userId)
      .eq("source", key.source)
      .eq("source_list_id", key.sourceListId);
    return { status: "unchanged" };
  }

  // 반영 전 원본 — 메모 비교 · 빠진 곳 찾기
  const before = await client
    .from("imported_items")
    .select("source_place_id, place_id, memo")
    .eq("user_id", userId)
    .eq("source", key.source)
    .eq("source_list_id", key.sourceListId);
  const oldItems = (before.data ?? []) as { source_place_id: string; place_id: string; memo: string }[];

  // 원본 메모가 바뀌었고 내 메모가 예전 원본 그대로면 새 메모로
  let memos = 0;
  const fresh = new Map(list.places.map((p) => [p.sourcePlaceId, p]));
  for (const old of oldItems) {
    const now = fresh.get(old.source_place_id);
    if (!now || now.memo === old.memo) continue;
    const res = await client
      .from("user_places")
      .update({ note: now.memo.slice(0, NOTE_MAX) })
      .eq("user_id", userId)
      .eq("place_id", old.place_id)
      .eq("note", old.memo.slice(0, NOTE_MAX))
      .select("place_id");
    memos += res.data?.length ?? 0;
  }

  // 새 곳 추가 · 원본 기록 갱신 (가져오기와 같은 규칙)
  const saved = await saveImportedList(client, userId, list, key.mode);

  // 빠진 곳 — 원본 기록 · 마이슐랭 리스트에서만 뺀다
  const gone = oldItems.filter((o) => !fresh.has(o.source_place_id));
  if (gone.length > 0) {
    await client
      .from("imported_items")
      .delete()
      .eq("user_id", userId)
      .eq("source", key.source)
      .eq("source_list_id", key.sourceListId)
      .in("source_place_id", gone.map((g) => g.source_place_id));
    if (saved.listId) {
      const still = await client
        .from("imported_items")
        .select("place_id")
        .eq("user_id", userId)
        .eq("source", key.source)
        .eq("source_list_id", key.sourceListId);
      const keep = new Set((still.data ?? []).map((r) => r.place_id as string));
      const drop = [...new Set(gone.map((g) => g.place_id))].filter((id) => !keep.has(id));
      if (drop.length) await client.from("list_items").delete().eq("list_id", saved.listId).in("place_id", drop);
    }
  }

  // 리스트 이름 — 마이슐랭에서 고치지 않았으면 원본 이름으로
  if (saved.listId && prev.data && list.name.trim()) {
    await client
      .from("lists")
      .update({ name: list.name.trim().slice(0, LIST_NAME_MAX) })
      .eq("id", saved.listId)
      .eq("name", (prev.data.list_name as string).trim().slice(0, LIST_NAME_MAX));
  }

  if (opts.updatePlaces) await updatePlaceFacts(client, list);
  await recordImportSource(client, userId, list, key.mode);
  return { status: "updated", added: saved.added, removed: gone.length, memos };
}

async function markFailed(client: SupabaseClient, userId: string, key: ImportSourceKey, status: "unavailable" | "error"): Promise<void> {
  const row = await client
    .from("import_sources")
    .select("fail_count")
    .eq("user_id", userId)
    .eq("source", key.source)
    .eq("source_list_id", key.sourceListId)
    .maybeSingle();
  await client
    .from("import_sources")
    .update({ status, fail_count: ((row.data?.fail_count as number | undefined) ?? 0) + 1, last_synced_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("source", key.source)
    .eq("source_list_id", key.sourceListId);
}

// 장소 자체(모두가 함께 쓰는 줄)의 이름 · 주소 · 업종 — 원본 출처 id 로 찾은 곳만 (원본이 바뀐 리스트일 때만 돈다)
async function updatePlaceFacts(admin: SupabaseClient, list: ImportedList): Promise<void> {
  for (const p of list.places) {
    await admin
      .from("places")
      .update({ name: p.name, address: p.address, category_name: p.categoryName, category_path: p.categoryPath, cuisine: p.cuisine })
      .eq("source", p.source)
      .eq("source_place_id", p.sourcePlaceId);
  }
}
