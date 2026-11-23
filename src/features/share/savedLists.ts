import { selectInChunks } from "@/lib/supabase/inChunks";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";

// 남의 리스트 저장 — 저장 수는 숫자만, 누가 저장했는지는 안 보인다
export type ListMeta = { ownerId: string; saves: number; saved: boolean; mine: boolean };
export type SavedList = { id: string; name: string; ownerNickname: string; count: number; newCount: number; updatedAt: string; cuisines: Cuisine[] };

export async function getListMeta(supabase: SupabaseClient, listId: string): Promise<ListMeta | null> {
  const { data, error } = await supabase.rpc("list_meta", { p_list: listId });
  if (error) throw new Error(`리스트 정보 조회 실패: ${error.code}`);
  const r = (data as { owner_id: string; saves: number; saved: boolean; mine: boolean }[])[0];
  return r ? { ownerId: r.owner_id, saves: r.saves, saved: r.saved, mine: r.mine } : null;
}

export async function getMySavedLists(supabase: SupabaseClient): Promise<SavedList[]> {
  const { data, error } = await supabase.rpc("my_saved_lists");
  if (error) throw new Error(`저장한 리스트 조회 실패: ${error.code}`);
  return (data as { id: string; name: string; owner_nickname: string; count: number; new_count: number; updated_at: string; cuisines: string[] }[]).map((r) => ({
    id: r.id,
    name: r.name,
    ownerNickname: r.owner_nickname,
    count: r.count,
    newCount: r.new_count,
    updatedAt: r.updated_at,
    cuisines: r.cuisines as Cuisine[],
  }));
}

// 이 리스트의 장소 중 내가 이미 저장한 곳
export async function getMySavedPlaceIds(supabase: SupabaseClient, me: string, placeIds: string[]): Promise<string[]> {
  if (placeIds.length === 0) return [];
  const { data, error } = await selectInChunks(placeIds, (part) => supabase.from("user_places").select("place_id").eq("user_id", me).in("place_id", part));
  if (error) throw new Error(`저장 확인 실패: ${error.code}`);
  return data.map((r) => r.place_id as string);
}
