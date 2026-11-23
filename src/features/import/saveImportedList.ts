import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedList, ImportedPlace } from "@/domain/importedPlace";
import { isSamePlace } from "@/domain/samePlace";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ImportMode } from "./importMode";

const NOTE_MAX = 300;
const LIST_NAME_MAX = 40;
const LIST_DESCRIPTION_MAX = 200;
const FALLBACK_LIST_NAME = "가져온 리스트";
// in() 필터가 URL 에 실리므로 나눠서 묻는다
const CHUNK = 200;

export type ImportResult = {
  listId: string | null;
  added: number;
  alreadySaved: number;
  unavailable: number;
  skipped: number;
  expected: number;
};

export class ImportSaveError extends Error {
  constructor(readonly step: string, readonly code?: string) {
    super(`가져오기 저장 실패: ${step}`);
    this.name = "ImportSaveError";
  }
}

// 다시 가져와도 늘지 않고, 먹킷에서 고친 등급 · 메모는 덮어쓰지 않는다
export async function saveImportedList(
  supabase: SupabaseClient,
  userId: string,
  list: ImportedList,
  mode: ImportMode,
): Promise<ImportResult> {
  const places = dedupeBySourceId(list.places);
  const placeIds = await upsertPlaces(places);
  await saveImportedItems(supabase, userId, list, places, placeIds);
  const alreadySaved = await saveUserPlaces(supabase, userId, places, placeIds, mode);
  const listId = mode.kind === "plain" ? await saveList(supabase, userId, list, [...new Set(placeIds.values())]) : null;

  return {
    listId,
    added: places.length - alreadySaved,
    alreadySaved,
    unavailable: places.filter((p) => !p.available).length,
    skipped: list.skipped.length,
    expected: list.expectedCount,
  };
}

function dedupeBySourceId(places: ImportedPlace[]): ImportedPlace[] {
  return [...new Map(places.map((p) => [p.sourcePlaceId, p])).values()];
}

// 장소는 모두가 함께 쓰는 줄 — 이미 있으면 건드리지 않는다 (상태 갱신은 주기 확인 작업 몫)
// 출처 ID 가 처음이면 다른 출처에서 온 같은 가게를 먼저 찾아 붙이고, 없을 때만 새 장소
// 쓰기는 서비스 키로만(DB 가 사용자 추가를 막음) — 넘기는 값은 서버가 네이버 · 카카오에서 직접 받았거나 다시 확인한 것이어야 한다
export async function upsertPlaces(places: ImportedPlace[]): Promise<Map<string, string>> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new ImportSaveError("admin_client");
  const ids = new Map<string, string>();
  for (const part of chunks(places)) {
    const known = await findLinkedPlaces(supabase, part);
    const unknown = part.filter((p) => !known.has(p.sourcePlaceId));
    if (unknown.length > 0) await linkOrCreatePlaces(supabase, unknown);
    const linked = unknown.length > 0 ? await findLinkedPlaces(supabase, part) : known;
    for (const [sid, placeId] of linked) ids.set(sid, placeId);
  }
  return ids;
}

async function findLinkedPlaces(supabase: SupabaseClient, part: ImportedPlace[]): Promise<Map<string, string>> {
  const found = await supabase
    .from("place_sources")
    .select("place_id, source_place_id")
    .eq("source", part[0].source)
    .in("source_place_id", part.map((p) => p.sourcePlaceId));
  if (found.error) throw new ImportSaveError("place_sources_select", found.error.code);
  return new Map(found.data.map((r) => [r.source_place_id as string, r.place_id as string]));
}

type NearRow = { idx: number; place_id: string; name: string; lat: number; lng: number; source: string };

async function linkOrCreatePlaces(supabase: SupabaseClient, unknown: ImportedPlace[]): Promise<void> {
  const near = await supabase.rpc("places_near", {
    points: unknown.map((p, idx) => ({ idx, lat: p.lat, lng: p.lng })),
  });
  if (near.error) throw new ImportSaveError("places_near", near.error.code);
  const candidates = near.data as NearRow[];

  const links: { place: ImportedPlace; placeId: string }[] = [];
  const fresh: ImportedPlace[] = [];
  unknown.forEach((p, idx) => {
    const match = candidates.find((c) => c.idx === idx && c.source !== p.source && isSamePlace(p, c));
    if (match) links.push({ place: p, placeId: match.place_id });
    else fresh.push(p);
  });

  if (fresh.length > 0) {
    const insert = await supabase.from("places").upsert(fresh.map(toPlaceRow), {
      onConflict: "source,source_place_id",
      ignoreDuplicates: true,
    });
    if (insert.error) throw new ImportSaveError("places", insert.error.code);
    const created = await supabase
      .from("places")
      .select("id, source_place_id")
      .eq("source", fresh[0].source)
      .in("source_place_id", fresh.map((p) => p.sourcePlaceId));
    if (created.error) throw new ImportSaveError("places_select", created.error.code);
    const byId = new Map(created.data.map((r) => [r.source_place_id as string, r.id as string]));
    for (const p of fresh) {
      const placeId = byId.get(p.sourcePlaceId);
      if (placeId) links.push({ place: p, placeId });
    }
  }

  const sources = await supabase.from("place_sources").upsert(
    links.map(({ place, placeId }) => ({
      source: place.source,
      source_place_id: place.sourcePlaceId,
      place_id: placeId,
      name: place.name,
      category_name: place.categoryName,
      category_path: place.categoryPath,
    })),
    { onConflict: "source,source_place_id", ignoreDuplicates: true },
  );
  if (sources.error) throw new ImportSaveError("place_sources", sources.error.code);
}

function toPlaceRow(p: ImportedPlace) {
  return {
    source: p.source,
    source_place_id: p.sourcePlaceId,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    address: p.address,
    category_path: p.categoryPath,
    category_name: p.categoryName,
    cuisine: p.cuisine,
    available: p.available,
  };
}

// 출처 · 리스트별 원본 — 다시 가져오면 최신 원본으로 바꾼다 (먹킷에서 고친 값과는 별개)
async function saveImportedItems(
  supabase: SupabaseClient,
  userId: string,
  list: ImportedList,
  places: ImportedPlace[],
  placeIds: Map<string, string>,
): Promise<void> {
  for (const part of chunks(places)) {
    const rows = part.flatMap((p) => {
      const placeId = placeIds.get(p.sourcePlaceId);
      return placeId
        ? [{
            user_id: userId,
            source: p.source,
            source_list_id: list.sourceListId,
            source_place_id: p.sourcePlaceId,
            place_id: placeId,
            list_name: list.name,
            memo: p.memo,
            category_name: p.categoryName,
            category_path: p.categoryPath,
            saved_at: p.savedAt.toISOString(),
            raw: p.raw ?? {},
            imported_at: new Date().toISOString(),
          }]
        : [];
    });
    const res = await supabase
      .from("imported_items")
      .upsert(rows, { onConflict: "user_id,source,source_list_id,source_place_id" });
    if (res.error) throw new ImportSaveError("imported_items", res.error.code);
  }
}

async function saveUserPlaces(
  supabase: SupabaseClient,
  userId: string,
  places: ImportedPlace[],
  placeIds: Map<string, string>,
  mode: ImportMode,
): Promise<number> {
  const tier = mode.kind === "tier" ? mode.tier : "unrated";
  let alreadySaved = 0;

  for (const part of chunks(places)) {
    const ids = part.map((p) => placeIds.get(p.sourcePlaceId)).filter((id): id is string => !!id);
    const existing = await supabase.from("user_places").select("place_id").eq("user_id", userId).in("place_id", ids);
    if (existing.error) throw new ImportSaveError("user_places_select", existing.error.code);
    const saved = new Set(existing.data.map((r) => r.place_id));
    alreadySaved += saved.size;

    const rows = part
      .filter((p) => !saved.has(placeIds.get(p.sourcePlaceId)))
      .map((p) => ({
        user_id: userId,
        place_id: placeIds.get(p.sourcePlaceId),
        tier,
        note: p.memo.slice(0, NOTE_MAX),
        saved_at: p.savedAt.toISOString(),
      }));
    if (rows.length > 0) {
      const insert = await supabase
        .from("user_places")
        .upsert(rows, { onConflict: "user_id,place_id", ignoreDuplicates: true });
      if (insert.error) throw new ImportSaveError("user_places", insert.error.code);
    }

    if (saved.size > 0) await applyToSavedPlaces(supabase, userId, part, placeIds, saved, mode);
  }
  return alreadySaved;
}

// 이미 내 장소인 곳에 원본을 다시 맞춤 (54) — 가져올 때 · 새로 고칠 때마다(원본에 그대로 있는 곳 포함)
// 등급 리스트면 아직 평가 전 · 가고 싶은 곳만 그 등급으로 (직접 매긴 3 · 2 · 1숟가락 · 추천 안 함은 그대로) + 원본 메모 채우기
export async function applyToSavedPlaces(
  supabase: SupabaseClient,
  userId: string,
  places: ImportedPlace[],
  placeIds: Map<string, string>,
  saved: Set<string>,
  mode: ImportMode,
  // 새로 고침에서 원본에 그대로 있는 곳은 빈 메모만 — 바뀐 원본 메모는 새로 고침의 메모 단계가 맡는다
  emptyOnly = false,
): Promise<void> {
  if (saved.size === 0) return;
  if (mode.kind === "tier") {
    const update = await supabase
      .from("user_places")
      .update({ tier: mode.tier, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("tier", ["unrated", "want_to_go"])
      .neq("tier", mode.tier)
      .in("place_id", [...saved]);
    if (update.error) throw new ImportSaveError("user_places_tier", update.error.code);
  }
  await fillImportedMemos(supabase, userId, places, placeIds, saved, emptyOnly);
}

// 이미 내 장소인 곳의 원본 메모 (54) — 내 메모가 비었거나, 같은 지도 앱(네이버 · 카카오)의 원본 메모 그대로일 때만 새 원본 메모로
// 같은 앱 안에서 리스트를 옮긴 경우를 반영하고, 먹킷에서 직접 쓴 메모 · 다른 앱에서 가져온 메모는 덮지 않는다
async function fillImportedMemos(
  supabase: SupabaseClient,
  userId: string,
  places: ImportedPlace[],
  placeIds: Map<string, string>,
  saved: Set<string>,
  emptyOnly = false,
): Promise<void> {
  const withMemo = places.filter((p) => p.memo.trim() && saved.has(placeIds.get(p.sourcePlaceId) ?? ""));
  if (withMemo.length === 0) return;
  const ids = withMemo.map((p) => placeIds.get(p.sourcePlaceId)!);
  const [mine, imported] = await Promise.all([
    supabase.from("user_places").select("place_id, note").eq("user_id", userId).in("place_id", ids),
    supabase.from("imported_items").select("place_id, source, memo").eq("user_id", userId).in("place_id", ids),
  ]);
  if (mine.error) throw new ImportSaveError("user_places_note", mine.error.code);
  if (imported.error) throw new ImportSaveError("imported_memos", imported.error.code);
  const noteOf = new Map(mine.data.map((r) => [r.place_id as string, (r.note as string) ?? ""]));
  const importedMemos = new Map<string, Set<string>>();
  for (const r of imported.data) {
    const key = `${r.place_id}:${r.source}`;
    const set = importedMemos.get(key) ?? new Set<string>();
    set.add(((r.memo as string) ?? "").slice(0, NOTE_MAX));
    importedMemos.set(key, set);
  }
  for (const p of withMemo) {
    const id = placeIds.get(p.sourcePlaceId)!;
    const note = noteOf.get(id) ?? "";
    const memo = p.memo.slice(0, NOTE_MAX);
    if (note === memo) continue;
    if (note !== "" && (emptyOnly || !importedMemos.get(`${id}:${p.source}`)?.has(note))) continue;
    const res = await supabase.from("user_places").update({ note: memo }).eq("user_id", userId).eq("place_id", id).eq("note", note);
    if (res.error) throw new ImportSaveError("user_places_note_update", res.error.code);
  }
}

// 같은 네이버 리스트는 한 사람에게 하나 — 부분 고유 인덱스라 upsert 대신 찾고 없으면 만든다
async function saveList(
  supabase: SupabaseClient,
  userId: string,
  list: ImportedList,
  placeIds: string[],
): Promise<string> {
  const found = await supabase
    .from("lists")
    .select("id")
    .eq("owner_id", userId)
    .eq("source", list.source)
    .eq("source_list_id", list.sourceListId)
    .maybeSingle();
  if (found.error) throw new ImportSaveError("lists_select", found.error.code);

  let listId = found.data?.id as string | undefined;
  if (!listId) {
    const created = await supabase
      .from("lists")
      .insert({
        owner_id: userId,
        name: list.name.trim().slice(0, LIST_NAME_MAX) || FALLBACK_LIST_NAME,
        description: list.memo.slice(0, LIST_DESCRIPTION_MAX),
        source: list.source,
        source_list_id: list.sourceListId,
      })
      .select("id")
      .single();
    if (created.error) throw new ImportSaveError("lists", created.error.code);
    listId = created.data.id as string;
  }

  for (const part of chunks(placeIds)) {
    const items = await supabase
      .from("list_items")
      .upsert(part.map((placeId) => ({ list_id: listId, place_id: placeId })), {
        onConflict: "list_id,place_id",
        ignoreDuplicates: true,
      });
    if (items.error) throw new ImportSaveError("list_items", items.error.code);
  }
  return listId;
}

function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}
