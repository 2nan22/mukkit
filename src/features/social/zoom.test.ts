import { describe, expect, it } from "vitest";
import { clampView, FIT, zoomAt } from "./zoom";

const box = { w: 400, h: 600 };
// 가로 사진 — 화면 폭에 맞춰 400×300 으로 그려짐
const pic = { w: 400, h: 300 };

describe("사진 확대 계산", () => {
  it("1배보다 작게 · 4배보다 크게는 안 됨", () => {
    expect(clampView({ scale: 0.5, x: 10, y: 10 }, pic, box)).toEqual(FIT);
    expect(clampView({ scale: 9, x: 0, y: 0 }, pic, box).scale).toBe(4);
  });

  it("화면보다 커진 만큼만 옮길 수 있음", () => {
    // 2배면 800×600 — 가로는 ±200, 세로는 화면(600)과 같아 못 옮김
    expect(clampView({ scale: 2, x: 999, y: -999 }, pic, box)).toEqual({ scale: 2, x: 200, y: 0 });
    // 3배면 1200×900 — 가로 ±400, 세로 ±150
    expect(clampView({ scale: 3, x: -999, y: 999 }, pic, box)).toEqual({ scale: 3, x: -400, y: 150 });
  });

  it("누른 곳이 손가락 밑에 그대로", () => {
    const at = { x: 100, y: -50 };
    const v = zoomAt(FIT, 2.5, at);
    // 확대 뒤 화면 좌표 = 원래 좌표 * scale + 이동 — 누른 점은 그대로
    expect(at.x * v.scale + v.x).toBeCloseTo(at.x * 2.5 + v.x);
    expect((at.x - v.x) / v.scale).toBeCloseTo(at.x);
    expect((at.y - v.y) / v.scale).toBeCloseTo(at.y);
  });
});
