import { metersBetween } from "./listSort";

// 약속 코스 (84) — 구간 거리 · 걷는 시간, 카카오 도보 경로 응답 해석, 지도 선 점 줄이기

export const COURSE_MAX = 5;

export type LatLng = { lat: number; lng: number };
// 구간 하나 — m · 초. estimated: 직선 어림(길 조회 실패 · 없음)
export type Leg = { meters: number; seconds: number };
export type CourseRoute = { legs: Leg[]; path: [number, number][]; estimated: boolean };

// 직선 어림 — 실제 길은 직선보다 길다(골목 · 횡단보도) · 걷기 분당 70m
const DETOUR = 1.3;
const WALK_M_PER_MIN = 70;

export function straightRoute(stops: LatLng[]): CourseRoute {
  const legs = stops.slice(1).map((b, i) => {
    const meters = Math.round(metersBetween(stops[i], b) * DETOUR);
    return { meters, seconds: Math.round((meters / WALK_M_PER_MIN) * 60) };
  });
  return { legs, path: stops.map((s) => [s.lng, s.lat]), estimated: true };
}

// 코스 순서를 한 줄로 — 저장된 길이 지금 코스의 것인지 맞춰 볼 때
export function courseKey(placeIds: string[]): string {
  return placeIds.join(",");
}

// '걸어서 9분' · 1분 미만은 1분
export function walkMinutes(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

export function metersLabel(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

type WalkResponse = {
  status?: string;
  route?: { legs?: { properties?: { distance?: number; time?: number }; steps?: { path?: { points?: number[][] } }[] }[] };
};

// 카카오 도보 경로 응답 → 구간 · 선. 구간 수가 안 맞거나 OK 가 아니면 null (직선 어림으로)
export function parseWalkRoute(body: unknown, legCount: number): { legs: Leg[]; path: [number, number][] } | null {
  const r = body as WalkResponse;
  if (r?.status !== "OK" || !r.route?.legs || r.route.legs.length !== legCount) return null;
  const legs: Leg[] = [];
  const path: [number, number][] = [];
  for (const leg of r.route.legs) {
    const meters = leg.properties?.distance;
    const seconds = leg.properties?.time;
    if (typeof meters !== "number" || typeof seconds !== "number") return null;
    legs.push({ meters, seconds });
    for (const step of leg.steps ?? []) {
      for (const p of step.path?.points ?? []) {
        if (p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) path.push([p[0], p[1]]);
      }
    }
  }
  return path.length >= 2 ? { legs, path: thinPath(path) } : null;
}

// 지도 선 점 줄이기 — 바로 앞 점과 거의 같은 자리(약 5m)는 건너뛰고, 그래도 많으면 고르게 솎는다
export function thinPath(path: [number, number][], max = 600): [number, number][] {
  const out: [number, number][] = [];
  for (const p of path) {
    const last = out[out.length - 1];
    if (last && Math.abs(last[0] - p[0]) < 0.00005 && Math.abs(last[1] - p[1]) < 0.00005) continue;
    out.push(p);
  }
  if (out.length <= max) return out;
  const step = (out.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => out[Math.round(i * step)]);
}
