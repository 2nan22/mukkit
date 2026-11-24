import { describe, expect, it } from "vitest";
import { reducedMemo } from "./refreshImport";

describe("reducedMemo (68-3)", () => {
  it("지우거나 비우면 줄어든 것", () => {
    expect(reducedMemo("010-1234 사장님 번호 · 맛있음", "맛있음")).toBe(true);
    expect(reducedMemo("맛있음", "")).toBe(true);
  });
  it("별명이 붙는 등 새 내용이 생기면 아님", () => {
    expect(reducedMemo("맛있음", "엄마 회사 앞 · 맛있음")).toBe(false);
    expect(reducedMemo("", "엄마 회사 앞")).toBe(false);
  });
});
