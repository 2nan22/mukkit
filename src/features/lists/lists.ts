import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PlaceSourceName } from "@/domain/importedPlace";

export const LIST_NAME_MAX = 40;
export const LIST_DESCRIPTION_MAX = 200;
export const VISIBILITIES = ["private", "link", "public"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  private: "비공개",
  link: "링크가 있는 사람만",
  public: "공개",
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
  patch: { name?: string; description?: string; visibility?: Visibility },
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
  const { data, error } = await supabase.from("lists").delete().eq("id", listId).eq("owner_id", userId).select("id");
  if (error) throw new ListWriteError("delete", error.code);
  if (data.length === 0) throw new ListNotFoundError();
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

export async function removePlaces(supabase: SupabaseClient, userId: string, listId: string, placeIds: string[]): Promise<void> {
  await assertOwnList(supabase, userId, listId);
  const { error } = await supabase.from("list_items").delete().eq("list_id", listId).in("place_id", placeIds);
  if (error) throw new ListWriteError("remove", error.code);
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
  updated_at: string;
  list_items: { count: number }[];
};

export async function getMyLists(supabase: SupabaseClient, userId: string): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, description, visibility, source, updated_at, list_items(count)")
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .returns<ListRow[]>();
  if (error) throw new ListWriteError("list", error.code);
  return data.map(toSummary);
}

export async function getMyList(supabase: SupabaseClient, userId: string, listId: string): Promise<(ListSummary & { placeIds: string[] }) | null> {
  const { data, error } = await supabase
    .from("lists")
    .select("id, name, description, visibility, source, updated_at, list_items(count)")
    .eq("id", listId)
    .eq("owner_id", userId)
    .maybeSingle<ListRow>();
  if (error) throw new ListWriteError("get", error.code);
  if (!data) return null;
  const items = await supabase.from("list_items").select("place_id").eq("list_id", listId).order("added_at", { ascending: false });
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
  };
}

export type ImportedListSummary = { source: PlaceSourceName; sourceListId: string; name: string; count: number };

// 가져온 원본 리스트 — 등급 리스트로 가져와 마이슐랭 리스트가 없는 것도 여기 남아 있다
export async function getImportedLists(supabase: SupabaseClient, userId: string): Promise<ImportedListSummary[]> {
  const { data, error } = await supabase
    .from("imported_items")
    .select("source, source_list_id, list_name")
    .eq("user_id", userId)
    .limit(10000);
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

export async function countMyTiers(supabase: SupabaseClient, userId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("user_places").select("tier").eq("user_id", userId).limit(10000);
  if (error) throw new ListWriteError("tiers", error.code);
  const counts: Record<string, number> = {};
  for (const r of data) counts[r.tier as string] = (counts[r.tier as string] ?? 0) + 1;
  return counts;
}
