import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { tierFromDb, type Tier } from "@/domain/tier";

export type PublicListPlace = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  cuisine: Cuisine;
  categoryName: string;
  tier: Tier | null;
};

export type PublicList = {
  id: string;
  name: string;
  description: string;
  visibility: "link" | "public";
  ownerNickname: string;
  places: PublicListPlace[];
};

type Row = {
  list_name: string;
  description: string;
  visibility: "link" | "public";
  owner_nickname: string;
  place_id: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  cuisine: string | null;
  category_name: string | null;
  tier: string | null;
};

// 링크 · 공개 리스트만 — 비공개거나 없으면 null. 메모 · 원본은 이 통로에 없다
export async function getPublicList(supabase: SupabaseClient, listId: string): Promise<PublicList | null> {
  if (!/^[0-9a-f-]{36}$/.test(listId)) return null;
  const { data, error } = await supabase.rpc("public_list", { p_list_id: listId });
  if (error) throw new Error(`공개 리스트 조회 실패: ${error.code}`);
  const rows = data as Row[];
  if (rows.length === 0) return null;
  const first = rows[0];
  return {
    id: listId,
    name: first.list_name,
    description: first.description,
    visibility: first.visibility,
    ownerNickname: first.owner_nickname,
    places: rows.flatMap((r) =>
      r.place_id && r.name && r.lat !== null && r.lng !== null
        ? [{
            placeId: r.place_id,
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            address: r.address ?? "",
            cuisine: (r.cuisine ?? "other") as Cuisine,
            categoryName: r.category_name ?? "",
            tier: r.tier ? tierFromDb(r.tier) : null,
          }]
        : [],
    ),
  };
}
