import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { tierFromDb, type Tier } from "@/domain/tier";
import { fetchAll } from "@/lib/supabase/fetchAll";

// 연말 결산 (70 · 94) — 넘기는 카드. 내 기록만 세고 나만 본다 · 가게 점수 · 평균 · 남과 비교 없음
// 올해 = 등급을 매긴 때(rated_at, 한국 시간). 저장은 지도에 저장한 때(saved_at)
// 평가 RECAP_FULL 곳부터 전체 카드, 그보다 적으면 줄인 카드 (평가 0곳이면 시작하기 화면)
export const RECAP_FULL = 10;
// 결산을 처음 낸 해 — 이보다 앞선 해는 열지 않는다
export const RECAP_FIRST_YEAR = 2026;
const RATED: readonly Tier[] = ["three", "two", "one", "notRecommended"];
const TOP = 3;

export type RecapRow = {
  placeId: string;
  name: string;
  tier: Tier;
  cuisine: Cuisine;
  address: string;
  ratedAt: string | null;
  savedAt: string;
  tierRank: number | null;
  isPrivate: boolean;
};
export type RecapPlace = { placeId: string; name: string; rank: number | null; isPrivate: boolean };
export type Companion = { name: string; visits: number; isGuest: boolean };
export type Recap = {
  year: number;
  rated: number;
  saved: number;
  unrated: number;
  full: boolean;
  tiers: { tier: Tier; count: number }[];
  cuisines: { cuisine: Cuisine; count: number }[];
  regions: { region: string; count: number }[];
  ranking: RecapPlace[];
  companions: Companion[];
};

const kst = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit" }).format(new Date(iso)).split("-").map(Number);
const kstYear = (iso: string) => kst(iso)[0];

// 결산하는 해 — 1월에는 지난해를 본다
export function recapYear(now = new Date()): number {
  const [y, m] = kst(now.toISOString());
  return m === 1 ? y - 1 : y;
}

// 들어가는 곳(홈 줄 · 알림함)을 보여 줄 때 — 12월 1일 ~ 1월 31일
export function isRecapSeason(now = new Date()): boolean {
  const m = kst(now.toISOString())[1];
  return m === 12 || m === 1;
}

// 결산 철이 아닐 때 다시 볼 지난 결산의 해 (없으면 null)
export function pastRecapYear(now = new Date()): number | null {
  if (isRecapSeason(now)) return null;
  const y = kst(now.toISOString())[0] - 1;
  return y >= RECAP_FIRST_YEAR ? y : null;
}

// 볼 수 있는 해인지 — 결산을 낸 해부터 지금 결산하는 해까지
export function isRecapYear(year: number, now = new Date()): boolean {
  return Number.isInteger(year) && year >= RECAP_FIRST_YEAR && year <= (isRecapSeason(now) ? recapYear(now) : kst(now.toISOString())[0] - 1);
}

// 많이 나온 것 상위 3 — 한 번뿐인 것은 '많이'라고 하지 않는다
function topOf<K extends string>(keys: K[]): { key: K; count: number }[] {
  const counts = new Map<K, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return [...counts]
    .map(([key, count]) => ({ key, count }))
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, TOP);
}

export function summarizeRecap(rows: RecapRow[], year: number, companions: Companion[] = []): Recap {
  const rated = rows.filter((r) => RATED.includes(r.tier) && r.ratedAt && kstYear(r.ratedAt) === year);
  // 나만의 맛집 순위 — 올해 3숟가락을 준 곳을 내가 정한 순위대로, 순위를 안 정한 곳은 뒤에 최근 것부터
  const ranking = rated
    .filter((r) => r.tier === "three")
    .sort((a, b) => (a.tierRank ?? Infinity) - (b.tierRank ?? Infinity) || (b.ratedAt ?? "").localeCompare(a.ratedAt ?? ""))
    .slice(0, TOP)
    .map((r) => ({ placeId: r.placeId, name: r.name, rank: r.tierRank, isPrivate: r.isPrivate }));
  return {
    year,
    rated: rated.length,
    saved: rows.filter((r) => kstYear(r.savedAt) === year).length,
    unrated: rows.filter((r) => r.tier === "unrated").length,
    full: rated.length >= RECAP_FULL,
    tiers: RATED.map((tier) => ({ tier, count: rated.filter((r) => r.tier === tier).length })),
    cuisines: topOf(rated.map((r) => r.cuisine).filter((c) => c !== "other")).map(({ key, count }) => ({ cuisine: key, count })),
    regions: topOf(rated.flatMap((r) => regionOf(r.address) ?? [])).map(({ key, count }) => ({ region: key, count })),
    ranking,
    companions,
  };
}

type Row = {
  place_id: string;
  tier: string;
  rated_at: string | null;
  saved_at: string;
  tier_rank: number | null;
  visibility: string;
  places: { name: string; cuisine: string; address: string } | null;
};

export async function getRecap(supabase: SupabaseClient, userId: string, year: number): Promise<Recap> {
  const [{ data, error }, people] = await Promise.all([
    fetchAll<Row>((from, to) =>
      supabase
        .from("user_places")
        .select("place_id, tier, rated_at, saved_at, tier_rank, visibility, places(name, cuisine, address)")
        .eq("user_id", userId)
        .order("place_id")
        .range(from, to)
        .returns<Row[]>(),
    ),
    supabase.rpc("my_recap_companions", { p_year: year }),
  ]);
  if (error) throw new Error(`연말 결산 조회 실패: ${error.code}`);
  const rows = data.flatMap((r) =>
    r.places
      ? [
          {
            placeId: r.place_id,
            name: r.places.name,
            tier: tierFromDb(r.tier),
            cuisine: r.places.cuisine as Cuisine,
            address: r.places.address,
            ratedAt: r.rated_at,
            savedAt: r.saved_at,
            tierRank: r.tier_rank,
            isPrivate: r.visibility === "private",
          },
        ]
      : [],
  );
  const companions = ((people.data ?? []) as { user_id: string | null; name: string; visits: number }[]).map((p) => ({
    name: p.name,
    visits: p.visits,
    isGuest: p.user_id === null,
  }));
  return summarizeRecap(rows, year, companions);
}

// 그해 평가한 곳이 있는지 (개수만 센다)
async function hasRated(supabase: SupabaseClient, userId: string, year: number): Promise<boolean> {
  const { count, error } = await supabase
    .from("user_places")
    .select("place_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("tier", ["three", "two", "one", "not_recommended"])
    .gte("rated_at", `${year}-01-01T00:00:00+09:00`)
    .lt("rated_at", `${year + 1}-01-01T00:00:00+09:00`);
  return !error && (count ?? 0) > 0;
}

// 홈 줄 · 알림함에 띄울지 — 결산 철이고 올해 평가한 곳이 있을 때
export async function recapReady(supabase: SupabaseClient, userId: string, now = new Date()): Promise<boolean> {
  return isRecapSeason(now) && hasRated(supabase, userId, recapYear(now));
}

// 내 기록 통계의 '지난 결산' — 철이 아닐 때 지난해에 평가한 곳이 있으면 그 해
export async function pastRecap(supabase: SupabaseClient, userId: string, now = new Date()): Promise<number | null> {
  const y = pastRecapYear(now);
  return y !== null && (await hasRated(supabase, userId, y)) ? y : null;
}
