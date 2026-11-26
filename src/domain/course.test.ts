import { describe, expect, it } from "vitest";
import { metersLabel, parseWalkRoute, straightRoute, thinPath, walkMinutes } from "./course";

describe("straightRoute", () => {
  it("구간마다 직선 × 1.3 · 분당 70m", () => {
    // 위도 0.001 ≈ 111m
    const r = straightRoute([{ lat: 37.5, lng: 127 }, { lat: 37.505, lng: 127 }, { lat: 37.505, lng: 127 }]);
    expect(r.estimated).toBe(true);
    expect(r.legs).toHaveLength(2);
    expect(r.legs[0].meters).toBe(Math.round(555 * 1.3));
    expect(r.legs[0].seconds).toBe(Math.round((722 / 70) * 60));
    expect(r.legs[1].meters).toBe(0);
    expect(r.path).toEqual([[127, 37.5], [127, 37.505], [127, 37.505]]);
  });
});

describe("parseWalkRoute", () => {
  const leg = (d: number, t: number, pts: number[][]) => ({ properties: { distance: d, time: t }, steps: [{ path: { points: pts } }] });
  it("OK 응답에서 구간 · 선", () => {
    const body = { status: "OK", route: { legs: [leg(650, 540, [[127, 37.5], [127.001, 37.501]]), leg(420, 360, [[127.001, 37.501], [127.003, 37.502]])] } };
    const r = parseWalkRoute(body, 2)!;
    expect(r.legs).toEqual([{ meters: 650, seconds: 540 }, { meters: 420, seconds: 360 }]);
    // 이어지는 같은 점은 하나로
    expect(r.path).toEqual([[127, 37.5], [127.001, 37.501], [127.003, 37.502]]);
  });
  it("OK 가 아니거나 구간 수가 다르면 null", () => {
    expect(parseWalkRoute({ status: "TOO_FAR_AWAY" }, 1)).toBeNull();
    expect(parseWalkRoute({ status: "OK", route: { legs: [leg(1, 1, [[1, 1], [2, 2]])] } }, 2)).toBeNull();
    expect(parseWalkRoute(null, 1)).toBeNull();
  });
});

describe("thinPath", () => {
  it("너무 많으면 처음 · 끝을 남기고 고르게", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => [127 + i * 0.001, 37.5] as [number, number]);
    const t = thinPath(pts, 100);
    expect(t).toHaveLength(100);
    expect(t[0]).toEqual(pts[0]);
    expect(t[99]).toEqual(pts[999]);
  });
});

describe("표시", () => {
  it("분은 1분 이상 · 거리는 10m 단위 또는 km", () => {
    expect(walkMinutes(20)).toBe(1);
    expect(walkMinutes(540)).toBe(9);
    expect(metersLabel(654)).toBe("650m");
    expect(metersLabel(1530)).toBe("1.5km");
  });
});
