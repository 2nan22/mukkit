import { describe, expect, it } from "vitest";
import { fitPadding } from "./PlaceMap";

describe("fitPadding", () => {
  it("지도보다 큰 여백은 지도 크기의 60% 안으로 줄인다", () => {
    const [t, , b] = fitPadding([160, 40, 220, 40], 390, 354);
    expect(t + b).toBeLessThanOrEqual(Math.round(354 * 0.6) + 1);
    expect(t).toBeLessThan(b);
  });
  it("넉넉한 지도면 그대로 둔다", () => {
    expect(fitPadding([160, 40, 220, 40], 390, 800)).toEqual([160, 40, 220, 40]);
  });
});
