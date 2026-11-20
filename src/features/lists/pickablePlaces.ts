import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { getMyMapPlaces, type MapPlace } from "@/features/map/myPlaces";

export type PlaceOrigin = { source: PlaceSourceName; listKey: string; listName: string; memo: string };
export type PickablePlace = MapPlace & { origins: PlaceOrigin[] };

// 내 저장 장소 + 가져온 원본(어느 플랫폼 · 어느 리스트에 · 어떤 메모로 있었는지)
export async function getPickablePlaces(supabase: SupabaseClient, userId: string): Promise<PickablePlace[]> {
  const [places, items] = await Promise.all([
    getMyMapPlaces(supabase, userId),
    supabase.from("imported_items").select("place_id, source, source_list_id, list_name, memo").eq("user_id", userId).limit(10000),
  ]);
  if (items.error) throw new Error(`원본 조회 실패: ${items.error.code}`);
  const byPlace = new Map<string, PlaceOrigin[]>();
  for (const r of items.data) {
    const list = byPlace.get(r.place_id as string) ?? [];
    list.push({
      source: r.source as PlaceSourceName,
      listKey: `${r.source}:${r.source_list_id}`,
      listName: r.list_name as string,
      memo: r.memo as string,
    });
    byPlace.set(r.place_id as string, list);
  }
  return places.map((p) => ({ ...p, origins: byPlace.get(p.placeId) ?? [] }));
}
