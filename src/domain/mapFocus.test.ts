import { describe, expect, it } from "vitest";
import { densestFocus, levelFor, nearMeFocus } from "./mapFocus";

const yeouido = [
  { lat: 37.5255, lng: 126.9245 },
  { lat: 37.5262, lng: 126.9268 },
  { lat: 37.5219, lng: 126.9297 },
];
const jeju = [{ lat: 33.4996, lng: 126.5312 }];
const busan = [{ lat: 35.1587, lng: 129.1604 }];

describe("mapFocus", () => {
  it("흩어져 있어도 가장 많이 모인 동네를 보여 준다", () => {
    const f = densestFocus([...yeouido, ...jeju, ...busan], 335)!;
    expect(f.lat).toBeCloseTo(37.524, 2);
    expect(f.lng).toBeCloseTo(126.927, 2);
    expect(f.level).toBeLessThanOrEqual(6);
  });

  it("넓게 퍼질수록 멀리 본다", () => {
    expect(levelFor(300, 335)).toBeLessThan(levelFor(5000, 335));
    expect(levelFor(1_000_000, 335)).toBe(8);
  });

  it("지금 위치 둘레에 장소가 있으면 거기, 없으면 null", () => {
    expect(nearMeFocus({ lat: 37.5251, lng: 126.925 }, yeouido, 335)).toMatchObject({ lat: 37.5251, lng: 126.925 });
    expect(nearMeFocus({ lat: 35.1, lng: 129 }, yeouido, 335)).toBeNull();
  });

  it("장소가 없으면 null", () => {
    expect(densestFocus([], 335)).toBeNull();
  });
});
