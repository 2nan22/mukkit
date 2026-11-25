import { LIST_COLOR_KEYS, listColorOf, type ListColor } from "@/domain/listColor";
import { fetchAll } from "@/lib/supabase/fetchAll";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { getPlaceCovers } from "@/features/place/covers";
import { topCuisines } from "@/components/ui/ListThumb";
import { z } from "zod";
import type { PlaceSourceName } from "@/domain/importedPlace";

export const LIST_NAME_MAX = 40;
export const LIST_DESCRIPTION_MAX = 200;
export const VISIBILITIES = ["private", "link", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "비공개",
  link: "링크가 있는 사람만",
  public: "전체 공개",
};

export const ListInputSchema = z.object({
  name: z.string().trim().min(1, "리스트 이름을 적어 주세요").max(LIST_NAME_MAX, `이름은 ${LIST_NAME_MAX}자까지예요`),
  description: z.string().trim().max(LIST_DESCRIPTION_MAX, `설명은 ${LIST_DESCRIPTION_MAX}자까지예요`).default(""),
});

export class ListNotFoundError extends Error {
  constructor() {
    super("리스트가 없거나 내 리스트가 아닙니다");
    this.name = "ListNotFoundError";
  }
}

export class ListWriteError extends Error {
  constructor(readonly step: string, readonly code?: string) {
    super(`리스트 저장 실패: ${step}`);
    this.name = "ListWriteError";
  }
}

export type ListSummary = {
  id: string;
  name: string;
  description: string;
  visibility: Visibility;
  source: PlaceSourceName | null;
  count: number;
  updatedAt: string;
  color: ListColor;
};

// 쓰기는 모두 owner_id 로 좁힌다 — RLS 가 막지만, 맞는 줄이 없으면 오류로 알린다
export async function createList(supabase: SupabaseClient, userId: string, input: { name: string; description: string }): Promise<string> {
  const { data, error } = await supabase
    .from("lists")
    .insert({ owner_id: userId, name: input.name, description: input.description })
    .select("id")
    .single();
  if (error) throw new ListWriteError("create", error.code);
  return data.id as string;
}

export async function updateList(
  supabase: SupabaseClient,
  userId: string,
  listId: string,
  patch: { name?: string; description?: string; visibility?: Visibility; color?: ListColor },
): Promise<void> {
  const { data, error } = await supabase
    .from("lists")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", listId)
    .eq("owner_id", userId)
    .select("id");
  if (error) throw new ListWriteError("update", error.code);
  if (data.length === 0) throw new ListNotFoundError();
}

export async function deleteList(supabase: SupabaseClient, userId: string, listId: string): Promise<void> {
  const { data, error } = await supabase.from("lists").delete().eq("id", listId).eq("owner_id", userId).select("id, source, source_list_id");
  if (error) throw new ListWriteError("delete", error.code);
  if (data.length === 0) throw new ListNotFoundError();
  // 가져온 리스트를 지우면 원본 새로 고침도 멈춘다 (지운 리스트를 새벽 작업이 다시 만들지 않게)
  const { source, source_list_id } = data[0] as { source: string | null; source_list_id: string | null };
  if (source && source_list_id) await supabase.from("import_sources").delete().eq("user_id", userId).eq("source", source).eq("source_list_id", source_list_id);
}

export async function addPlaces(supabase: SupabaseClient, userId: string, listId: string, placeIds: string[]): Promise<void> {
  await assertOwnList(supabase, userId, listId);
  if (placeIds.length === 0) return;
  const { error } = await supabase
    .from("list_items")
    .upsert(placeIds.map((placeId) => ({ list_id: listId, place_id: placeId })), {
      onConflict: "list_id,place_id",
      ignoreDuplicates: true,
    });
  if (error) throw new ListWriteError("add", error.code);
  await touch(supabase, listId);
}

export type RemovedItem = { placeId: string; addedAt: string };

// 뺀 장소의 담은 시각을 돌려준다 — 되돌리기 때 원래 자리로 넣으려고
export async function removePlaces(supabase: SupabaseClient, userId: string, listId: string, placeIds: string[]): Promise<RemovedItem[]> {
  await assertOwnList(supabase, userId, listId);
  const { data, error } = await supabase.from("list_items").delete().eq("list_id", listId).in("place_id", placeIds).select("place_id, added_at");
  if (error) throw new ListWriteError("remove", error.code);
  await touch(supabase, listId);
  return (data ?? []).map((r) => ({ placeId: r.place_id as string, addedAt: r.added_at as string }));
}

export async function restorePlaces(supabase: SupabaseClient, userId: string, listId: string, items: RemovedItem[]): Promise<void> {
  await assertOwnList(supabase, userId, listId);
  if (items.length === 0) return;
  const { error } = await supabase
    .from("list_items")
    .upsert(items.map((i) => ({ list_id: listId, place_id: i.placeId, added_at: i.addedAt })), { onConflict: "list_id,place_id", ignoreDuplicates: true });
  if (error) throw new ListWriteError("add", error.code);
  await touch(supabase, listId);
}

async function assertOwnList(supabase: SupabaseClient, userId: string, listId: string): Promise<void> {
  const { data, error } = await supabase.from("lists").select("id").eq("id", listId).eq("owner_id", userId).maybeSingle();
  if (error) throw new ListWriteError("owner", error.code);
  if (!data) throw new ListNotFoundError();
}

async function touch(supabase: SupabaseClient, listId: string): Promise<void> {
  await supabase.from("lists").update({ updated_at: new Date().toISOString() }).eq("id", listId);
}

type ListRow = {
  id: string;
  name: string;
  description: string;
  visibility: Visibility;
  source: string | null;
  color: string | null;
  updated_at: string;
  list_items: { count: number }[];
};

export async function getMyLists(supabase: SupabaseClient, userId: string): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, description, visibility, source, color, updated_at, list_items(count)")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .returns<ListRow[]>();
  if (error) throw new ListWriteError("list", error.code);
  return data.map(toSummary);
}

const THUMB_SLOTS = 4;

export type ListThumb = { photos: string[]; cuisines: Cuisine[] };

// 리스트 카드 썸네일 — 담긴 곳의 대표 사진(내 사진 · 팔로잉) 최대 4장 + 많이 담긴 업종 순서
export async function getMyListThumbs(supabase: SupabaseClient, listIds: string[]): Promise<Map<string, ListThumb>> {
  const out = new Map<string, ListThumb>();
  if (listIds.length === 0) return out;
  // 리스트마다 최근 40곳 — 한 번에 묻으면 큰 리스트 하나가 1000행 한도를 다 써서 다른 리스트 썸네일이 비었다
  const results = await Promise.all(
    listIds.map((id) => supabase.from("list_items").select("list_id, place_id, places(cuisine)").eq("list_id", id).order("added_at", { ascending: false }).limit(40)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new ListWriteError("thumbs", failed.error.code);
  const rows = results.flatMap((r) => r.data ?? []) as unknown as { list_id: string; place_id: string; places: { cuisine: Cuisine } | null }[];
  const covers = await getPlaceCovers(supabase, rows.map((r) => r.place_id));
  const byList = new Map<string, typeof rows>();
  for (const r of rows) byList.set(r.list_id, [...(byList.get(r.list_id) ?? []), r]);
  for (const [listId, items] of byList) {
    const photos = items.flatMap((r) => (covers.get(r.place_id) ? [covers.get(r.place_id)!.url] : [])).slice(0, THUMB_SLOTS);
    const cuisines = topCuisines(items.flatMap((r) => (r.places ? [{ cuisine: r.places.cuisine }] : [])));
    out.set(listId, { photos, cuisines });
  }
  return out;
}

export async function getMyList(supabase: SupabaseClient, userId: string, listId: string): Promise<(ListSummary & { placeIds: string[] }) | null> {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, description, visibility, source, color, updated_at, list_items(count)")
    .eq("id", listId)
    .eq("owner_id", userId)
    .maybeSingle<ListRow>();
  if (error) throw new ListWriteError("get", error.code);
  if (!data) return null;
  const items = await fetchAll((from, to) =>
    supabase.from("list_items").select("place_id").eq("list_id", listId).order("added_at", { ascending: false }).order("place_id").range(from, to),
  );
  if (items.error) throw new ListWriteError("items", items.error.code);
  return { ...toSummary(data), placeIds: items.data.map((r) => r.place_id as string) };
}

function toSummary(row: ListRow): ListSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    source: (row.source as PlaceSourceName | null) ?? null,
    count: row.list_items[0]?.count ?? 0,
    updatedAt: row.updated_at,
    color: listColorOf(row.id, row.color),
  };
}

export type ImportedListSummary = { source: PlaceSourceName; sourceListId: string; name: string; count: number };

// 가져온 원본 리스트 — 등급 리스트로 가져와 먹킷 리스트가 없는 것도 여기 남아 있다
export async function getImportedLists(supabase: SupabaseClient, userId: string): Promise<ImportedListSummary[]> {
  const { data, error } = await fetchAll((from, to) =>
    supabase.from("imported_items").select("source, source_list_id, list_name").eq("user_id", userId).order("source_list_id").order("source_place_id").range(from, to),
  );
  if (error) throw new ListWriteError("imported", error.code);
  const groups = new Map<string, ImportedListSummary>();
  for (const r of data) {
    const key = `${r.source}:${r.source_list_id}`;
    const g = groups.get(key) ?? { source: r.source as PlaceSourceName, sourceListId: r.source_list_id as string, name: r.list_name as string, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// 등급별 곳 수 — 행을 받아 세지 않고 DB 가 센 개수만 (행 수 제한 1000에 걸리지 않게, 55)
const DB_TIER_KEYS = ["three", "two", "one", "not_recommended", "want_to_go", "unrated"] as const;
export async function countMyTiers(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const results = await Promise.all(
    DB_TIER_KEYS.map((t) => supabase.from("user_places").select("place_id", { count: "exact", head: true }).eq("user_id", userId).eq("tier", t)),
  );
  const counts: Record<string, number> = {};
  results.forEach((r, i) => {
    if (r.error) throw new ListWriteError("tiers", r.error.code);
    if (r.count) counts[DB_TIER_KEYS[i]] = r.count;
  });
  return counts;
}

export type MapList = { id: string; name: string; color: ListColor; placeIds: string[]; source: PlaceSourceName | null; imported?: boolean };

// 지도 '리스트로 보기' — 내 리스트(최근에 담은 순) + 먹킷 리스트로 만들지 않은 가져온 원본 리스트(등급 리스트로 가져온 것)
export async function getMyMapLists(supabase: SupabaseClient, userId: string): Promise<MapList[]> {
  const [own, raw] = await Promise.all([
    supabase
      .from("lists")
      .select("id, name, color, source, source_list_id, updated_at, list_items(place_id, added_at)")
      .eq("owner_id", userId)
      .order("updated_at", { ascending: false })
      .returns<{ id: string; name: string; color: string | null; source: string | null; source_list_id: string | null; list_items: { place_id: string; added_at: string }[] }[]>(),
    fetchAll((from, to) =>
      supabase.from("imported_items").select("source, source_list_id, list_name, place_id, saved_at").eq("user_id", userId).order("source_list_id").order("source_place_id").range(from, to),
    ),
  ]);
  if (own.error) throw new ListWriteError("map", own.error.code);
  if (raw.error) throw new ListWriteError("map-imported", raw.error.code);
  const lists: MapList[] = own.data.map((l) => ({
    id: l.id,
    name: l.name,
    color: listColorOf(l.id, l.color),
    source: (l.source as PlaceSourceName | null) ?? null,
    placeIds: [...l.list_items].sort((a, b) => b.added_at.localeCompare(a.added_at)).map((i) => i.place_id),
  }));
  const madeFrom = new Set(own.data.flatMap((l) => (l.source && l.source_list_id ? [`${l.source}:${l.source_list_id}`] : [])));
  const groups = new Map<string, { name: string; source: PlaceSourceName; items: { placeId: string; at: string }[] }>();
  for (const r of raw.data) {
    const key = `${r.source}:${r.source_list_id}`;
    if (madeFrom.has(key) || !r.place_id) continue;
    const g = groups.get(key) ?? { name: r.list_name as string, source: r.source as PlaceSourceName, items: [] };
    g.items.push({ placeId: r.place_id as string, at: (r.saved_at as string | null) ?? "" });
    groups.set(key, g);
  }
  // 가져온 원본 리스트는 색을 저장하지 않으니, 내 리스트가 안 쓴 색부터 차례로 (많이 담긴 리스트 먼저)
  const used = new Map<ListColor, number>(LIST_COLOR_KEYS.map((c) => [c, 0]));
  for (const l of lists) used.set(l.color, (used.get(l.color) ?? 0) + 1);
  for (const [key, g] of [...groups.entries()].sort((a, b) => b[1].items.length - a[1].items.length)) {
    const color = LIST_COLOR_KEYS.reduce((best, c) => (used.get(c)! < used.get(best)! ? c : best));
    used.set(color, used.get(color)! + 1);
    lists.push({ id: `imported:${key}`, name: g.name, color, source: g.source, imported: true, placeIds: g.items.sort((a, b) => b.at.localeCompare(a.at)).map((i) => i.placeId) });
  }
  return lists;
}
