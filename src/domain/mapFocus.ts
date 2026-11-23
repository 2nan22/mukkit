import { distanceMeters } from "./samePlace";

export type LatLng = { lat: number; lng: number };
export type MapFocus = { lat: number; lng: number; level: number };

// 약 2km 칸 — 이 칸과 둘레 8칸을 한 동네로 본다
const CELL = 0.02;
// 카카오맵 확대 수준별 1px 당 대략 몇 m (레벨 3 ≈ 1m, 한 단계마다 두 배)
const metersPerPx = (level: number) => 2 ** (level - 3);
const MIN_LEVEL = 4;
const MAX_LEVEL = 8;

// 가로 width px 안에 반경 radius m 가 들어가는 가장 가까운 확대 수준
export function levelFor(radius: number, width: number): number {
  for (let level = MIN_LEVEL; level < MAX_LEVEL; level++) {
    if (radius * 2 <= width * metersPerPx(level) * 0.8) return level;
  }
  return MAX_LEVEL;
}

// 장소가 가장 많이 모인 동네 — 전국에 흩어져 있어도 한반도 전체가 아니라 많이 다니는 곳을 보여 준다 (50)
export function densestFocus(points: LatLng[], width: number): MapFocus | null {
  if (points.length === 0) return null;
  const cells = new Map<string, LatLng[]>();
  const key = (p: LatLng, dx = 0, dy = 0) => `${Math.floor(p.lat / CELL) + dy}:${Math.floor(p.lng / CELL) + dx}`;
  for (const p of points) {
    const k = key(p);
    cells.set(k, [...(cells.get(k) ?? []), p]);
  }
  let best: LatLng[] = [];
  for (const p of points) {
    const around: LatLng[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) around.push(...(cells.get(key(p, dx, dy)) ?? []));
    if (around.length > best.length) best = around;
  }
  return focusOn(best, width);
}

// 이 점들이 다 보이게 — 가운데와 확대 수준
export function focusOn(points: LatLng[], width: number): MapFocus | null {
  if (points.length === 0) return null;
  const center = { lat: points.reduce((a, p) => a + p.lat, 0) / points.length, lng: points.reduce((a, p) => a + p.lng, 0) / points.length };
  const radius = Math.max(300, ...points.map((p) => distanceMeters({ name: "", ...center }, { name: "", ...p })));
  return { ...center, level: levelFor(radius, width) };
}

// 지금 위치 둘레(반경 near m)에 장소가 있으면 그 둘레, 없으면 null
export function nearMeFocus(me: LatLng, points: LatLng[], width: number, near = 3000): MapFocus | null {
  const around = points.filter((p) => distanceMeters({ name: "", ...me }, { name: "", ...p }) <= near);
  if (around.length === 0) return null;
  const f = focusOn([me, ...around], width);
  return f && { ...f, lat: me.lat, lng: me.lng };
}
