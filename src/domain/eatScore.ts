import type { Cuisine } from "./cuisine";
import { distanceMeters } from "./samePlace";
import type { Tier } from "./tier";

// 여기서 뭐 먹지 — 가게 평균 점수가 아니라 '나에게' 맞는 정도. 비중은 이 파일에서만 바꾼다
export type Rater = { userId: string; nickname: string; tier: "three" | "two"; followed: boolean; overlap: number; similarity: number | null };
export type Candidate = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  cuisine: Cuisine;
  categoryName: string;
  myTier: Tier | null;
  raters: Rater[];
};
export type Scored = Candidate & { score: number; distance: number; reasons: string[] };
export type CuisineGroup = { cuisine: Cuisine; places: Scored[] };

const MINE: Partial<Record<Tier, { weight: number; reason: string }>> = {
  three: { weight: 2.5, reason: "내 3숟가락" },
  two: { weight: 1.5, reason: "내 2숟가락" },
  wantToGo: { weight: 2.0, reason: "내가 가고 싶은 곳" },
};
const RATER_TIER = { three: 1.0, two: 0.6 } as const;
const SIMILAR_ENOUGH = 0.7;
const MIN_OVERLAP = 2;
const PER_GROUP = 5;

// 나와 겹치는 평가가 있으면 비슷함으로, 없으면 중간값 · 팔로잉이면 더 믿는다
export function raterWeight(r: Rater): number {
  const trust = r.overlap >= MIN_OVERLAP && r.similarity !== null ? 0.4 + r.similarity : 0.6;
  return RATER_TIER[r.tier] * trust * (r.followed ? 1 : 0.7);
}

export function scoreCandidate(c: Candidate, origin: { lat: number; lng: number }, radius: number, pref: Partial<Record<Cuisine, number>>): Scored | null {
  const distance = distanceMeters({ name: "", ...origin }, { name: "", lat: c.lat, lng: c.lng });
  if (distance > radius || c.cuisine === "nonFood") return null;
  const mine = c.myTier ? MINE[c.myTier] : undefined;
  const ranked = [...c.raters].sort((a, b) => raterWeight(b) - raterWeight(a));
  const social = ranked.slice(0, 3).reduce((sum, r, i) => sum + raterWeight(r) * [1, 0.5, 0.25][i], 0);
  const base = (mine?.weight ?? 0) + social;
  if (base === 0) return null;
  const score = base * (1 + 0.5 * (pref[c.cuisine] ?? 0)) * (1 - 0.4 * (distance / radius));

  const reasons: string[] = [];
  if (mine) reasons.push(mine.reason);
  for (const r of ranked.slice(0, 2)) {
    const why = r.followed ? "팔로잉" : r.overlap >= MIN_OVERLAP && (r.similarity ?? 0) >= SIMILAR_ENOUGH ? "취향 비슷" : "";
    reasons.push(`${r.nickname} ${r.tier === "three" ? "3숟가락" : "2숟가락"}${why ? ` · ${why}` : ""}`);
  }
  if (ranked.length > 2) reasons.push(`외 ${ranked.length - 2}명`);
  return { ...c, score, distance, reasons };
}

// 업종별로 묶고, 내가 좋아하는 업종부터 · 업종 안에서는 점수 순
export function groupRecommendations(
  candidates: Candidate[],
  origin: { lat: number; lng: number },
  radius: number,
  pref: Partial<Record<Cuisine, number>>,
): CuisineGroup[] {
  const scored = candidates.flatMap((c) => scoreCandidate(c, origin, radius, pref) ?? []);
  const groups = new Map<Cuisine, Scored[]>();
  for (const s of scored) groups.set(s.cuisine, [...(groups.get(s.cuisine) ?? []), s]);
  return [...groups.entries()]
    .map(([cuisine, places]) => ({ cuisine, places: places.sort((a, b) => b.score - a.score).slice(0, PER_GROUP) }))
    .sort((a, b) => (pref[b.cuisine] ?? 0) - (pref[a.cuisine] ?? 0) || b.places[0].score - a.places[0].score);
}

// 내 3 · 2숟가락이 업종마다 얼마나 몰려 있는지 (0~1)
export function cuisinePreference(rows: { cuisine: Cuisine; tier: Tier }[]): Partial<Record<Cuisine, number>> {
  const liked = rows.filter((r) => r.tier === "three" || r.tier === "two");
  if (liked.length === 0) return {};
  const counts: Partial<Record<Cuisine, number>> = {};
  for (const r of liked) counts[r.cuisine] = (counts[r.cuisine] ?? 0) + (r.tier === "three" ? 1.5 : 1);
  const max = Math.max(...Object.values(counts).map((v) => v ?? 0));
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (v ?? 0) / max]));
}
