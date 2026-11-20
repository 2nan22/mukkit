import { describe, expect, it } from "vitest";
import { naverCuisineOf, summarizeNaverCuisines } from "./naverCuisine";

describe("naverCuisineOf", () => {
  it("음식점 2단계 코드로 음식 종류를 정한다", () => {
    expect(naverCuisineOf(["220036", "220038", "220081"])).toEqual({ cuisine: "japanese", unmapped: false });
    expect(naverCuisineOf(["220036", "220052"])).toEqual({ cuisine: "cafe", unmapped: false });
  });

  it("음식점이 아니면 nonFood, 표에 없는 음식점 코드는 other 로 떨어지고 표시된다", () => {
    expect(naverCuisineOf(["223563", "224652"])).toEqual({ cuisine: "nonFood", unmapped: false });
    expect(naverCuisineOf(["220036", "999999"])).toEqual({ cuisine: "other", unmapped: true });
    expect(naverCuisineOf([])).toEqual({ cuisine: "nonFood", unmapped: false });
  });
});

describe("summarizeNaverCuisines", () => {
  it("미매핑 개수와 코드를 센다", () => {
    const summary = summarizeNaverCuisines([
      ["220036", "220037"],
      ["220036", "999999", "1"],
      ["223563"],
    ]);
    expect(summary.foodCount).toBe(2);
    expect(summary.unmappedCount).toBe(1);
    expect(summary.unmappedCodes).toEqual(["220036>999999"]);
    expect(summary.counts.korean).toBe(1);
    expect(summary.counts.nonFood).toBe(1);
  });
});
