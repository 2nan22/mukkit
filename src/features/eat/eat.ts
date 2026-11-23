import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetchAll";
import type { Cuisine } from "@/domain/cuisine";
import { cuisinePreference, type Candidate, type Rater } from "@/domain/eatScore";
import { regionOf } from "@/domain/region";
import { tierFromDb, type Tier } from "@/domain/tier";

export type Region = { name: string; lat: number; lng: number; count: number };

type CandidateRow = {
  place_id: string; name: string; lat: number; lng: number; address: string; cuisine: string; category_name: string;
  my_tier: string | null; raters: Rater[];
};

export async function getEatCandidates(supabase: SupabaseClient, lat: number, lng: number, radius: number): Promise<Candidate[]> {
  const { data, error } = await supabase.rpc("eat_candidates", { p_lat: lat, p_lng: lng, p_radius_m: radius });
  if (error) throw new Error(`추천 후보 조회 실패: ${error.code}`);
  return (data as CandidateRow[]).map((r) => ({
    placeId: r.place_id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    cuisine: r.cuisine as Cuisine,
    categoryName: r.category_name,
    myTier: r.my_tier ? tierFromDb(r.my_tier) : null,
    raters: r.raters.map((x) => ({ ...x, similarity: x.similarity === null ? null : Number(x.similarity) })),
  }));
}

type MineRow = { tier: string; places: { cuisine: string; lat: number; lng: number; address: string } | null };

// 내 저장으로 업종 취향과 자주 가는 지역(가운데 좌표)을 함께 만든다
export async function getMyTasteBasis(supabase: SupabaseClient, me: string): Promise<{ pref: Partial<Record<Cuisine, number>>; regions: Region[] }> {
  const { data, error } = await fetchAll((from, to) =>
    supabase.from("user_places").select("tier, places(cuisine, lat, lng, address)").eq("user_id", me).order("place_id").range(from, to),
  );
  if (error) throw new Error(`내 저장 조회 실패: ${error.code}`);
  const rows = (data as unknown as MineRow[]).flatMap((r) => (r.places ? [{ tier: tierFromDb(r.tier) as Tier, ...r.places }] : []));
  const pref = cuisinePreference(rows.map((r) => ({ cuisine: r.cuisine as Cuisine, tier: r.tier })));
  const byRegion = new Map<string, { lat: number; lng: number; count: number }>();
  for (const r of rows) {
    const name = regionOf(r.address);
    if (!name) continue;
    const g = byRegion.get(name) ?? { lat: 0, lng: 0, count: 0 };
    g.lat += r.lat;
    g.lng += r.lng;
    g.count += 1;
    byRegion.set(name, g);
  }
  const regions = [...byRegion.entries()]
    .map(([name, g]) => ({ name, lat: g.lat / g.count, lng: g.lng / g.count, count: g.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 16);
  return { pref, regions };
}
