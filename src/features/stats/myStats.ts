import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { tierFromDb, type Tier } from "@/domain/tier";
import { fetchAll } from "@/lib/supabase/fetchAll";

// 내 기록 통계 (68) — 핵심만: 숫자 셋 · 내 등급 · 많이 저장한 음식 · 평가한 곳이 많은 동네. 내 기록만 세고 나만 본다
export const RATED_TIERS = ["three", "two", "one", "notRecommended"] as const;
// 등급 · 동네는 평가가 이만큼은 있어야 보여 준다 — 몇 곳으로 '취향'처럼 보이지 않게
export const MIN_RATED = 10;
const TOP = 3;

export type StatRow = { tier: Tier; cuisine: Cuisine; address: string };
export type MyStats = {
  saved: number;
  rated: number;
  three: number;
  unrated: number;
  tiers: { tier: (typeof RATED_TIERS)[number]; count: number }[];
  cuisines: { cuisine: Cuisine; count: number }[];
  regions: { region: string; count: number }[];
};

function top<K extends string>(counts: Map<K, number>): { key: K; count: number }[] {
  return [...counts].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)).slice(0, TOP);
}

export function summarizeStats(rows: StatRow[]): MyStats {
  const isRated = (t: Tier) => (RATED_TIERS as readonly Tier[]).includes(t);
  const rated = rows.filter((r) => isRated(r.tier));
  const cuisines = new Map<Cuisine, number>();
  // 기타(업종을 못 정한 곳)는 '많이 저장한 음식'에서 뺀다
  for (const r of rows) if (r.cuisine !== "other") cuisines.set(r.cuisine, (cuisines.get(r.cuisine) ?? 0) + 1);
  // 동네는 실제로 간 곳(평가한 곳)만
  const regions = new Map<string, number>();
  for (const r of rated) {
    const region = regionOf(r.address);
    if (region) regions.set(region, (regions.get(region) ?? 0) + 1);
  }
  return {
    saved: rows.length,
    rated: rated.length,
    three: rated.filter((r) => r.tier === "three").length,
    unrated: rows.filter((r) => r.tier === "unrated").length,
    tiers: RATED_TIERS.map((tier) => ({ tier, count: rated.filter((r) => r.tier === tier).length })),
    cuisines: top(cuisines).map(({ key, count }) => ({ cuisine: key, count })),
    regions: top(regions).map(({ key, count }) => ({ region: key, count })),
  };
}

type Row = { tier: string; places: { cuisine: string; address: string } | null };

export async function getMyStats(supabase: SupabaseClient, userId: string): Promise<MyStats> {
  const { data, error } = await fetchAll<Row>((from, to) =>
    supabase.from("user_places").select("tier, places(cuisine, address)").eq("user_id", userId).order("place_id").range(from, to).returns<Row[]>(),
  );
  if (error) throw new Error(`내 기록 통계 조회 실패: ${error.code}`);
  return summarizeStats(data.flatMap((r) => (r.places ? [{ tier: tierFromDb(r.tier), cuisine: r.places.cuisine as Cuisine, address: r.places.address }] : [])));
}
