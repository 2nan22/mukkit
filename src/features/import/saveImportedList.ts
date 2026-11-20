import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedList, ImportedPlace } from "@/domain/importedPlace";
import type { ImportMode } from "./importMode";

const NOTE_MAX = 300;
const LIST_NAME_MAX = 40;
const LIST_DESCRIPTION_MAX = 200;
const FALLBACK_LIST_NAME = "네이버 리스트";
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

// 다시 가져와도 늘지 않고, 마이슐랭에서 고친 등급 · 메모는 덮어쓰지 않는다
export async function saveImportedList(
  supabase: SupabaseClient,
  userId: string,
  list: ImportedList,
  mode: ImportMode,
): Promise<ImportResult> {
  const places = dedupeBySourceId(list.places);
  const placeIds = await upsertPlaces(supabase, places);
  const alreadySaved = await saveUserPlaces(supabase, userId, places, placeIds, mode);
  const listId = mode.kind === "plain" ? await saveList(supabase, userId, list, [...placeIds.values()]) : null;

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
async function upsertPlaces(supabase: SupabaseClient, places: ImportedPlace[]): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const part of chunks(places)) {
    const rows = part.map((p) => ({
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
    }));
    const insert = await supabase
      .from("places")
      .upsert(rows, { onConflict: "source,source_place_id", ignoreDuplicates: true });
    if (insert.error) throw new ImportSaveError("places", insert.error.code);

    const found = await supabase
      .from("places")
      .select("id, source_place_id")
      .eq("source", part[0].source)
      .in("source_place_id", part.map((p) => p.sourcePlaceId));
    if (found.error) throw new ImportSaveError("places_select", found.error.code);
    for (const row of found.data) ids.set(row.source_place_id, row.id);
  }
  return ids;
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

    // 등급 리스트를 다시 가져오면 아직 평가 전인 곳만 그 등급으로
    if (mode.kind === "tier" && saved.size > 0) {
      const update = await supabase
        .from("user_places")
        .update({ tier, updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("tier", "unrated")
        .in("place_id", [...saved]);
      if (update.error) throw new ImportSaveError("user_places_tier", update.error.code);
    }
  }
  return alreadySaved;
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
