import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { tierFromDb, type Tier } from "@/domain/tier";
import { fetchAll } from "@/lib/supabase/fetchAll";

export type HomePoint = { id: string; lat: number; lng: number; tier: Tier };
export type HomeRecent = { placeId: string; name: string; cuisine: Cuisine; kind: string | null; tier: Tier };
export type MyHome = {
  points: HomePoint[];
  recent: HomeRecent[];
};

type Row = { tier: string; places: { id: string; name: string; lat: number; lng: number; cuisine: string; food_kind: string | null } | null };

const RECENT = 10;

// 홈의 내 지도 · 최근 저장 (49) — 최근에 저장한 순으로 한 번만 읽는다
// 핀은 내 장소 전부 — 지도 아래 숫자를 보이는 범위로 세려면 다 있어야 한다 (65, 묶음 원이 많은 핀을 받는다)
export async function getMyHome(supabase: SupabaseClient, userId: string): Promise<MyHome> {
  const { data, error } = await fetchAll<Row>((from, to) =>
    supabase
      .from("user_places")
      .select("tier, places(id, name, lat, lng, cuisine, food_kind)")
      .eq("user_id", userId)
      .order("saved_at", { ascending: false })
      .order("place_id")
      .range(from, to)
      .returns<Row[]>(),
  );
  if (error) throw new Error(`홈 내 장소 조회 실패: ${error.code}`);
  const rows = data.flatMap((r) => (r.places ? [{ tier: tierFromDb(r.tier), place: r.places }] : []));
  return {
    points: rows.map((r) => ({ id: r.place.id, lat: r.place.lat, lng: r.place.lng, tier: r.tier })),
    recent: rows.slice(0, RECENT).map((r) => ({ placeId: r.place.id, name: r.place.name, cuisine: r.place.cuisine as Cuisine, kind: r.place.food_kind, tier: r.tier })),
  };
}
