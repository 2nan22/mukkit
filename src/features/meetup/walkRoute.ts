import "server-only";
import { parseWalkRoute, type LatLng, type Leg } from "@/domain/course";
import { timedFetch } from "@/lib/http/timedFetch";

// 카카오맵 도보 경로 (2026-07-21 공개, 하루 1,000건 무료) — 다른 길찾기로 바꿀 때 이 파일만
// 출발 · 도착 + 경유지 최대 5곳을 한 번에 · X 가 경도
const WALK_URL = "https://dapi.kakao.com/v2/routing/walk";

// null = 키 없음 · 실패 · 경로 없음 — 부르는 쪽이 직선 어림으로
export async function fetchWalkRoute(stops: LatLng[]): Promise<{ legs: Leg[]; path: [number, number][] } | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key || stops.length < 2 || stops.length > 7) return null;
  const first = stops[0];
  const last = stops[stops.length - 1];
  const via = stops.slice(1, -1);
  const params = new URLSearchParams({ start_x: String(first.lng), start_y: String(first.lat), end_x: String(last.lng), end_y: String(last.lat) });
  if (via.length) {
    params.set("via_x", via.map((v) => v.lng).join(","));
    params.set("via_y", via.map((v) => v.lat).join(","));
  }
  try {
    const res = await timedFetch(`${WALK_URL}?${params}`, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" });
    if (!res.ok) {
      console.warn("[KAKAO WALK] 조회 실패: status=%d", res.status);
      return null;
    }
    const route = parseWalkRoute(await res.json(), stops.length - 1);
    if (!route) console.warn("[KAKAO WALK] 경로 없음 또는 해석 실패: stops=%d", stops.length);
    return route;
  } catch (e) {
    console.warn("[KAKAO WALK] 네트워크 오류: %s", e instanceof Error ? e.name : "unknown");
    return null;
  }
}
