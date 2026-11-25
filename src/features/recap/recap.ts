import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { tierFromDb, type Tier } from "@/domain/tier";
import { fetchAll } from "@/lib/supabase/fetchAll";

// 연말 결산 (70) — 넘기는 카드 5장. 내 기록만 세고 나만 본다 · 가게 점수 · 평균 없음
// 올해 = 평가 날짜(updated_at, 한국 시간). 가져온 평가는 지도에 저장한 날이 평가 날짜다 (68-9)
export const RECAP_MIN = 10;
const RATED: readonly Tier[] = ["three", "two", "one", "notRecommended"];

export type RecapRow = { placeId: string; name: string; tier: Tier; cuisine: Cuisine; address: string; updatedAt: string; savedAt: string; tierRank: number | null };
export type Recap = {
  year: number;
  rated: number;
  saved: number;
  tiers: { tier: Tier; count: number }[];
  best: { placeId: string; name: string; rank: number | null; threeCount: number } | null;
  cuisine: { cuisine: Cuisine; count: number } | null;
  region: { region: string; count: number } | null;
};

const kstYear = (iso: string) => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric" }).format(new Date(iso)));

// 결산하는 해 — 1월에는 지난해를 본다
export function recapYear(now = new Date()): number {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(now).split("-").map(Number);
  return m === 1 ? y - 1 : y;
}

// 들어가는 곳(홈 · 내 기록 통계)을 보여 줄 때 — 12월 1일 ~ 1월 31일
export function isRecapSeason(now = new Date()): boolean {
  const m = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", month: "2-digit" }).format(now));
  return m === 12 || m === 1;
}

function topOf<K extends string>(keys: K[]): { key: K; count: number } | null {
  const counts = new Map<K, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  const [first] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return first ? { key: first[0], count: first[1] } : null;
}

export function summarizeRecap(rows: RecapRow[], year: number): Recap {
  const rated = rows.filter((r) => RATED.includes(r.tier) && kstYear(r.updatedAt) === year);
  const threes = rated.filter((r) => r.tier === "three");
  // 올해의 3숟가락 — 나만의 맛집 순위가 가장 높은 곳, 순위를 안 정했으면 가장 최근 것
  const best = [...threes].sort((a, b) => (a.tierRank ?? Infinity) - (b.tierRank ?? Infinity) || b.updatedAt.localeCompare(a.updatedAt))[0];
  // 음식 · 동네는 한 번뿐이면 '가장 많이'라고 하지 않는다
  const cuisine = topOf(rated.map((r) => r.cuisine).filter((c) => c !== "other"));
  const region = topOf(rated.flatMap((r) => regionOf(r.address) ?? []));
  return {
    year,
    rated: rated.length,
    saved: rows.filter((r) => kstYear(r.savedAt) === year).length,
    tiers: RATED.map((tier) => ({ tier, count: rated.filter((r) => r.tier === tier).length })),
    best: best ? { placeId: best.placeId, name: best.name, rank: best.tierRank, threeCount: threes.length } : null,
    cuisine: cuisine && cuisine.count >= 2 ? { cuisine: cuisine.key, count: cuisine.count } : null,
    region: region && region.count >= 2 ? { region: region.key, count: region.count } : null,
  };
}

type Row = { place_id: string; tier: string; updated_at: string; saved_at: string; tier_rank: number | null; places: { name: string; cuisine: string; address: string } | null };

export async function getRecap(supabase: SupabaseClient, userId: string, year = recapYear()): Promise<Recap> {
  const { data, error } = await fetchAll<Row>((from, to) =>
    supabase
      .from("user_places")
      .select("place_id, tier, updated_at, saved_at, tier_rank, places(name, cuisine, address)")
      .eq("user_id", userId)
      .order("place_id")
      .range(from, to)
      .returns<Row[]>(),
  );
  if (error) throw new Error(`연말 결산 조회 실패: ${error.code}`);
  const rows = data.flatMap((r) =>
    r.places
      ? [{ placeId: r.place_id, name: r.places.name, tier: tierFromDb(r.tier), cuisine: r.places.cuisine as Cuisine, address: r.places.address, updatedAt: r.updated_at, savedAt: r.saved_at, tierRank: r.tier_rank }]
      : [],
  );
  return summarizeRecap(rows, year);
}

// 들어가는 곳에 띄울지 — 결산 철이고 올해 평가가 충분할 때만 (개수만 센다)
export async function recapReady(supabase: SupabaseClient, userId: string, now = new Date()): Promise<boolean> {
  if (!isRecapSeason(now)) return false;
  const y = recapYear(now);
  const { count, error } = await supabase
    .from("user_places")
    .select("place_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("tier", ["three", "two", "one", "not_recommended"])
    .gte("updated_at", `${y}-01-01T00:00:00+09:00`)
    .lt("updated_at", `${y + 1}-01-01T00:00:00+09:00`);
  return !error && (count ?? 0) >= RECAP_MIN;
}
