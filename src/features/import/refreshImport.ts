import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ImportError, type ImportedList, type PlaceSource, type PlaceSourceName } from "@/domain/importedPlace";
import type { ImportMode } from "./importMode";
import { applyToSavedPlaces, saveImportedList } from "./saveImportedList";
import { placeSourceFor } from "./sources";

const NOTE_MAX = 300;
const LIST_NAME_MAX = 40;
// 한 번에 이만큼 넘게 빠지면 원본 쪽 일시 오류로 보고 반영하지 않는다
const MAX_REMOVE_RATIO = 0.5;
const MIN_FOR_GUARD = 3;

export type ImportSourceKey = { source: PlaceSourceName; sourceListId: string; mode: ImportMode };
export type RefreshResult =
  | { status: "unchanged" }
  | { status: "updated"; added: number; removed: number; memos: number }
  | { status: "unavailable" | "error" | "dropped" };

// 원본 요약 — 반영하는 값(목록 · 메모 · 리스트 이름)만. 장소 자체 정보(이름 · 업종 · 폐업)는 폐업 확인 작업 몫
export function hashList(list: ImportedList): string {
  const places = [...list.places].sort((a, b) => a.sourcePlaceId.localeCompare(b.sourcePlaceId)).map((p) => [p.sourcePlaceId, p.memo]);
  return createHash("sha256").update(JSON.stringify([list.name, list.memo, places])).digest("hex");
}

// 가져올 때 · 새로 고칠 때 기록 남기기
export async function recordImportSource(client: SupabaseClient, userId: string, list: ImportedList, mode: ImportMode): Promise<void> {
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

// 원본을 다시 읽어 반영
// - 빠진 곳: 먹킷 리스트 · 원본 기록에서만 뺀다 (내 장소 · 등급 · 메모 · 사진은 그대로)
// - 새 곳: 가져올 때 고른 방식대로 추가 (전에 있던 곳은 다시 넣지 않는다 — 내가 리스트에서 뺀 곳이 되살아나지 않게)
// - 원본 메모 · 리스트 이름: 내가 고치지 않은 것만 원본대로
// - 원본이 일부만 오거나 절반 넘게 빠지면 반영하지 않고 실패로 남긴다
export async function refreshImport(client: SupabaseClient, userId: string, key: ImportSourceKey, opts: { placeSource?: PlaceSource } = {}): Promise<RefreshResult> {
  const where = { user_id: userId, source: key.source, source_list_id: key.sourceListId };

  // 그냥 저장한 리스트인데 먹킷 리스트를 지웠으면 새로 고침을 멈춘다
  let listId: string | null = null;
  if (key.mode.kind === "plain") {
    const own = await client.from("lists").select("id").eq("owner_id", userId).eq("source", key.source).eq("source_list_id", key.sourceListId).maybeSingle();
    if (!own.data) {
      await client.from("import_sources").delete().match(where);
      return { status: "dropped" };
    }
    listId = own.data.id as string;
  }

  const before = await client.from("imported_items").select("source_place_id, place_id, memo").match(where);
  const oldItems = (before.data ?? []) as { source_place_id: string; place_id: string; memo: string }[];
  const known = new Set(oldItems.map((o) => o.source_place_id));

  let list: ImportedList;
  try {
    list = await (opts.placeSource ?? placeSourceFor(key.source)).fetchList(key.sourceListId, { knownIds: known });
  } catch (e) {
    const unavailable = e instanceof ImportError && e.code === "LIST_NOT_FOUND_OR_PRIVATE";
    await markFailed(client, userId, key, unavailable ? "unavailable" : "error");
    return { status: unavailable ? "unavailable" : "error" };
  }

  const fresh = new Map(list.places.map((p) => [p.sourcePlaceId, p]));
  const gone = oldItems.filter((o) => !fresh.has(o.source_place_id));
  const partial = list.skipped.length > 0 || list.places.length < list.expectedCount;
  const tooMany = oldItems.length >= MIN_FOR_GUARD && gone.length / oldItems.length > MAX_REMOVE_RATIO;
  if (partial || tooMany) {
    await markFailed(client, userId, key, "error");
    return { status: "error" };
  }

  // 원본에 그대로 있는 곳도 등급 · 빈 메모를 원본에 맞춤 — 다른 리스트에서 옮겨 와 전에 반영이 안 된 곳 (54)
  const knownNow = list.places.filter((p) => known.has(p.sourcePlaceId));
  if (knownNow.length > 0) {
    const ids = new Map(oldItems.map((o) => [o.source_place_id, o.place_id]));
    await applyToSavedPlaces(client, userId, knownNow, ids, new Set(knownNow.map((p) => ids.get(p.sourcePlaceId)!)), key.mode, true);
  }

  const prev = await client.from("import_sources").select("last_hash, list_name").match(where).maybeSingle();
  if (prev.data?.last_hash === hashList(list)) {
    await client.from("import_sources").update({ last_synced_at: new Date().toISOString(), status: "ok", fail_count: 0 }).match(where);
    return { status: "unchanged" };
  }

  // 원본 메모가 바뀌었고 내 메모가 예전 원본 그대로면 새 메모로 · 원본 기록의 메모도 갱신
  let memos = 0;
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
    await client.from("imported_items").update({ memo: now.memo }).match({ ...where, source_place_id: old.source_place_id });
  }

  // 새 곳만 가져오기 규칙으로
  const added = list.places.filter((p) => !known.has(p.sourcePlaceId));
  const saved = added.length > 0 ? await saveImportedList(client, userId, { ...list, places: added }, key.mode) : null;

  // 빠진 곳 — 원본 기록 · 먹킷 리스트에서만
  if (gone.length > 0) {
    await client.from("imported_items").delete().match(where).in("source_place_id", gone.map((g) => g.source_place_id));
    if (listId) {
      const still = await client.from("imported_items").select("place_id").match(where);
      const keep = new Set((still.data ?? []).map((r) => r.place_id as string));
      const drop = [...new Set(gone.map((g) => g.place_id))].filter((id) => !keep.has(id));
      if (drop.length) await client.from("list_items").delete().eq("list_id", listId).in("place_id", drop);
    }
  }

  // 리스트 이름 — 먹킷에서 고치지 않았으면 원본 이름으로
  if (listId && prev.data && list.name.trim()) {
    await client
      .from("lists")
      .update({ name: list.name.trim().slice(0, LIST_NAME_MAX) })
      .eq("id", listId)
      .eq("name", (prev.data.list_name as string).trim().slice(0, LIST_NAME_MAX));
  }

  await recordImportSource(client, userId, list, key.mode);
  return { status: "updated", added: saved?.added ?? 0, removed: gone.length, memos };
}

async function markFailed(client: SupabaseClient, userId: string, key: ImportSourceKey, status: "unavailable" | "error"): Promise<void> {
  const where = { user_id: userId, source: key.source, source_list_id: key.sourceListId };
  const row = await client.from("import_sources").select("fail_count").match(where).maybeSingle();
  await client
    .from("import_sources")
    .update({ status, fail_count: ((row.data?.fail_count as number | undefined) ?? 0) + 1, last_synced_at: new Date().toISOString() })
    .match(where);
}
