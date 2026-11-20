import { describe, expect, it } from "vitest";
import { wcongToLatLng } from "./kakaoCoords";

// 카카오 장소 상세가 준 위경도와 같은 장소의 즐겨찾기 x · y
const SAMPLES = [
  { x: 511751, y: 1123637, lat: 37.544593751108145, lng: 127.05318829056812 },
  { x: 511818, y: 1123096, lat: 37.54264385215378, lng: 127.05349015800877 },
];

function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dy = (a.lat - b.lat) * 110_950;
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

describe("wcongToLatLng", () => {
  it.each(SAMPLES)("카카오 좌표가 위경도와 10m 안으로 맞는다 ($x, $y)", ({ x, y, lat, lng }) => {
    expect(meters(wcongToLatLng(x, y), { lat, lng })).toBeLessThan(10);
  });
});
