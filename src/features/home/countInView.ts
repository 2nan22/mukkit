import type { Tier } from "@/domain/tier";

type Bounds = { south: number; west: number; north: number; east: number };
export type ViewCounts = { saved: number; three: number; want: number };

// 지도에 보이는 범위 안 내 장소 수 — 홈 내 지도 아래 숫자 (65)
export function countInView(points: { lat: number; lng: number; tier: Tier }[], b: Bounds): ViewCounts {
  const out: ViewCounts = { saved: 0, three: 0, want: 0 };
  for (const p of points) {
    if (p.lat < b.south || p.lat > b.north || p.lng < b.west || p.lng > b.east) continue;
    out.saved += 1;
    if (p.tier === "three") out.three += 1;
    if (p.tier === "wantToGo") out.want += 1;
  }
  return out;
}
