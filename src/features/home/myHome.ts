import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { tierFromDb, type Tier } from "@/domain/tier";

export type HomePoint = { id: string; lat: number; lng: number; tier: Tier };
export type HomeRecent = { placeId: string; name: string; cuisine: Cuisine; tier: Tier };
export type MyHome = {
  points: HomePoint[];
  recent: HomeRecent[];
  saved: number;
  three: number;
  wantToGo: number;
  unrated: number;
};

type Row = { tier: string; places: { id: string; name: string; lat: number; lng: number; cuisine: string } | null };

const MAX_POINTS = 1000;
const RECENT = 10;

// 홈의 내 지도 · 최근 저장 (49) — 최근에 저장한 순으로 한 번만 읽는다
export async function getMyHome(supabase: SupabaseClient, userId: string): Promise<MyHome> {
  const { data, error } = await supabase
    .from("user_places")
    .select("tier, places(id, name, lat, lng, cuisine)")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false })
    .limit(MAX_POINTS)
    .returns<Row[]>();
  if (error) throw new Error(`홈 내 장소 조회 실패: ${error.code}`);
  const rows = data.flatMap((r) => (r.places ? [{ tier: tierFromDb(r.tier), place: r.places }] : []));
  const count = (t: Tier) => rows.filter((r) => r.tier === t).length;
  return {
    points: rows.map((r) => ({ id: r.place.id, lat: r.place.lat, lng: r.place.lng, tier: r.tier })),
    recent: rows.slice(0, RECENT).map((r) => ({ placeId: r.place.id, name: r.place.name, cuisine: r.place.cuisine as Cuisine, tier: r.tier })),
    saved: rows.length,
    three: count("three"),
    wantToGo: count("wantToGo"),
    unrated: count("unrated"),
  };
}
