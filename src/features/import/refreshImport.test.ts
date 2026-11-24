import { describe, expect, it } from "vitest";
import { reducedMemo } from "./saveImportedList";

describe("reducedMemo (68-3)", () => {
  it("지우거나 비우면 줄어든 것", () => {
    expect(reducedMemo("010-1234 사장님 번호 · 맛있음", "맛있음")).toBe(true);
  });
  it("별명이 붙는 등 새 내용이 생기면 아님", () => {
    expect(reducedMemo("맛있음", "엄마 회사 앞 · 맛있음")).toBe(false);
    expect(reducedMemo("", "엄마 회사 앞")).toBe(false);
    // 비워도 공개 유지 대상이 아님 — 빈 메모는 공개로 두지 않는다 (68-4)
    expect(reducedMemo("맛있음", "")).toBe(false);
    // 잘려서 안 보이던 뒷부분이 드러나면 새 정보
    expect(reducedMemo("가".repeat(300) + "비밀", "가".repeat(299) + "비밀")).toBe(false);
  });
});
