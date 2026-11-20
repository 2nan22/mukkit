import type { Cuisine } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import type { Tier } from "@/domain/tier";
import type { PickablePlace } from "./pickablePlaces";

// 같은 묶음 안에서는 하나라도 맞으면, 묶음끼리는 모두 맞아야 추천
export type Criteria = {
  regions: string[];
  cuisines: Cuisine[];
  labels: string[];
  tiers: Tier[];
  keyword: string;
};

export const EMPTY_CRITERIA: Criteria = { regions: [], cuisines: [], labels: [], tiers: [], keyword: "" };

export function hasCriteria(c: Criteria): boolean {
  return c.regions.length + c.cuisines.length + c.labels.length + c.tiers.length > 0 || c.keyword.trim() !== "";
}

export function matchPlaces(places: PickablePlace[], c: Criteria): PickablePlace[] {
  const q = c.keyword.trim().toLowerCase();
  return places.filter((p) => {
    if (c.regions.length && !c.regions.includes(regionOf(p.address) ?? "")) return false;
    if (c.cuisines.length && !c.cuisines.includes(p.cuisine)) return false;
    if (c.labels.length && !p.origins.some((o) => c.labels.includes(o.listKey))) return false;
    if (c.tiers.length && !c.tiers.includes(p.tier)) return false;
    if (!q) return true;
    const text = [p.name, p.address, p.note, p.categoryName, ...p.origins.flatMap((o) => [o.listName, o.memo])].join(" ").toLowerCase();
    return text.includes(q);
  });
}

// 고를 수 있는 값과 개수 — 많은 순
export function countBy<T extends string>(places: PickablePlace[], pick: (p: PickablePlace) => T[]): [T, number][] {
  const m = new Map<T, number>();
  for (const p of places) for (const v of new Set(pick(p))) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
