import { describe, expect, it } from "vitest";
import { regionLabel, shortDong } from "./regionLabel";

describe("shortDong", () => {
  it("숫자 · '가'를 뗀다", () => {
    expect(shortDong("성수1가1동")).toBe("성수동");
    expect(shortDong("역삼1동")).toBe("역삼동");
    expect(shortDong("서교동")).toBe("서교동");
    expect(shortDong("종로1·2·3·4가동")).toBe("종로1·2·3·4가동");
  });
});

describe("regionLabel", () => {
  it("좁게 보면 구 동, 넓게 보면 구만", () => {
    expect(regionLabel("성동구", "성수1가1동", 0.01)).toBe("성동구 성수동");
    expect(regionLabel("마포구", "서교동", 0.05)).toBe("마포구");
  });
});
