import { describe, expect, it } from "vitest";
import { kakaoCuisineOf } from "./kakaoCuisine";

describe("kakaoCuisineOf", () => {
  it("음식점 2단계 이름으로 음식 종류를 정한다", () => {
    expect(kakaoCuisineOf(["음식점", "한식", "해장국"])).toEqual({ cuisine: "korean", unmapped: false });
    expect(kakaoCuisineOf(["음식점", "아시아음식", "베트남음식"])).toEqual({ cuisine: "asian", unmapped: false });
    expect(kakaoCuisineOf(["음식점", "카페"])).toEqual({ cuisine: "cafe", unmapped: false });
  });

  it("음식점이 아니면 nonFood, 표에 없는 음식점 분류는 other 로 표시", () => {
    expect(kakaoCuisineOf(["서비스,산업", "마케팅"])).toEqual({ cuisine: "nonFood", unmapped: false });
    expect(kakaoCuisineOf(["음식점", "뷔페"])).toEqual({ cuisine: "other", unmapped: true });
    expect(kakaoCuisineOf([])).toEqual({ cuisine: "nonFood", unmapped: false });
  });
});
