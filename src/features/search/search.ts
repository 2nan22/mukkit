import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { tierFromDb, type Tier } from "@/domain/tier";

// lat · lng 는 카카오 결과와 같은 가게를 거를 때만 쓴다
export type MyPlaceHit = { placeId: string; name: string; cuisine: Cuisine; region: string; tier: Tier; lat: number; lng: number };

// 검색어에서 ilike 를 깨는 문자 제거
export function cleanQuery(q: string): string {
  return q.trim().replace(/[%_,()\\]/g, "").slice(0, 40);
}

export async function searchMyPlaces(supabase: SupabaseClient, me: string, q: string): Promise<MyPlaceHit[]> {
  const { data, error } = await supabase
    .from("user_places")
    .select("tier, places!inner(id, name, address, cuisine, lat, lng)")
    .eq("user_id", me)
    .ilike("places.name", `%${q}%`)
    .limit(10);
  if (error) return [];
  return (data as unknown as { tier: string; places: { id: string; name: string; address: string; cuisine: Cuisine; lat: number; lng: number } }[]).map((r) => ({
    placeId: r.places.id,
    name: r.places.name,
    cuisine: r.places.cuisine,
    region: regionOf(r.places.address) ?? "",
    tier: tierFromDb(r.tier),
    lat: r.places.lat,
    lng: r.places.lng,
  }));
}

// 카카오 장소 ID → 이미 있는 마이슐랭 장소 · 내 등급
export async function knownKakaoPlaces(supabase: SupabaseClient, me: string, kakaoIds: string[]): Promise<Map<string, { placeId: string; tier: Tier | null }>> {
  const out = new Map<string, { placeId: string; tier: Tier | null }>();
  if (kakaoIds.length === 0) return out;
  const { data } = await supabase.from("place_sources").select("place_id, source_place_id").eq("source", "kakao").in("source_place_id", kakaoIds);
  const rows = (data ?? []) as { place_id: string; source_place_id: string }[];
  if (rows.length === 0) return out;
  const { data: mine } = await supabase.from("user_places").select("place_id, tier").eq("user_id", me).in("place_id", rows.map((r) => r.place_id));
  const tiers = new Map(((mine ?? []) as { place_id: string; tier: string }[]).map((m) => [m.place_id, tierFromDb(m.tier)]));
  for (const r of rows) out.set(r.source_place_id, { placeId: r.place_id, tier: tiers.get(r.place_id) ?? null });
  return out;
}
