import { describe, expect, it } from "vitest";
import { regionOf } from "./region";

describe("regionOf", () => {
  it("시 · 도 + 시 · 군 · 구", () => {
    expect(regionOf("서울 영등포구 여의대로 1")).toBe("서울 영등포구");
    expect(regionOf("서울특별시 중구 을지로 00")).toBe("서울 중구");
    expect(regionOf("경기 고양시 일산동구 백석동")).toBe("경기 고양시");
    expect(regionOf("세종특별자치시 한누리대로 1")).toBe("세종");
  });

  it("시 · 도로 시작하지 않으면 지역 없음", () => {
    expect(regionOf("성수동2가 315-1")).toBeNull();
    expect(regionOf("")).toBeNull();
  });
});
