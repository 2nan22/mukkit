import type { Tier } from "./tier";

// 리스트 안 정렬 — 담은 순(리스트가 준 순서) · 등급 · 이름 · 내 위치에서 가까운 순
export const LIST_SORTS = ["added", "tier", "name", "near"] as const;
export type ListSort = (typeof LIST_SORTS)[number];

export const LIST_SORT_LABEL: Record<ListSort, string> = { added: "담은 순", tier: "등급 순", name: "이름 순", near: "가까운 순" };

// 높은 등급이 위, 평가하지 않은 곳(가고 싶은 곳 · 평가 전 · 없음)은 아래
const TIER_ORDER: Record<Tier, number> = { three: 0, two: 1, one: 2, notRecommended: 3, wantToGo: 4, unrated: 5 };

type Sortable = { name: string; lat: number; lng: number; tier: Tier | null };
type Point = { lat: number; lng: number };

// 두 점 사이 대략 거리(m) — 동네 안 순서만 가르면 되므로 평면 근사
export function metersBetween(a: Point, b: Point): number {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(a.lat - b.lat, (a.lng - b.lng) * k) * 111_000;
}

const byName = new Intl.Collator("ko");

// 원래 순서(담은 순)를 지킨 채 고르고 정렬한다 — 같은 값이면 담은 순서 그대로
export function sortListPlaces<T extends Sortable>(items: readonly T[], sort: ListSort, opts: { tiers?: readonly Tier[]; me?: Point | null } = {}): T[] {
  const tiers = opts.tiers ?? [];
  const kept = tiers.length ? items.filter((p) => p.tier !== null && tiers.includes(p.tier)) : [...items];
  const indexed = kept.map((p, i) => ({ p, i }));
  const cmp = (a: { p: T; i: number }, b: { p: T; i: number }): number => {
    if (sort === "tier") return TIER_ORDER[a.p.tier ?? "unrated"] - TIER_ORDER[b.p.tier ?? "unrated"] || a.i - b.i;
    if (sort === "name") return byName.compare(a.p.name, b.p.name) || a.i - b.i;
    if (sort === "near" && opts.me) return metersBetween(opts.me, a.p) - metersBetween(opts.me, b.p) || a.i - b.i;
    return a.i - b.i;
  };
  return indexed.sort(cmp).map((x) => x.p);
}

// 거리 표시 — 1km 안은 10m 단위, 그 밖은 0.1km
export function distanceLabel(m: number): string {
  return m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)}m` : `${(m / 1000).toFixed(1)}km`;
}
