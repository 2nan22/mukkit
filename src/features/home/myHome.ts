import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { tierFromDb, type Tier } from "@/domain/tier";

export type HomePoint = { id: string; lat: number; lng: number; tier: Tier };
export type HomeRecent = { placeId: string; name: string; cuisine: Cuisine; tier: Tier };
export type MyHome = {
  points: HomePoint[];
  recent: HomeRecent[];
};

type Row = { tier: string; places: { id: string; name: string; lat: number; lng: number; cuisine: string } | null };

// 미리보기 핀은 최근 저장한 순으로 이만큼만 — 숫자는 등급 집계(countMyTiers)로 따로 센다
const MAX_POINTS = 300;
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
  return {
    points: rows.map((r) => ({ id: r.place.id, lat: r.place.lat, lng: r.place.lng, tier: r.tier })),
    recent: rows.slice(0, RECENT).map((r) => ({ placeId: r.place.id, name: r.place.name, cuisine: r.place.cuisine as Cuisine, tier: r.tier })),
  };
}
