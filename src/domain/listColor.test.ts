import { describe, expect, it } from "vitest";
import { isListColor, LIST_COLOR_KEYS, listColorOf } from "./listColor";

describe("리스트 색", () => {
  it("고른 색이 있으면 그 색", () => {
    expect(listColorOf("abc", "teal")).toBe("teal");
  });
  it("없거나 모르는 값이면 id 로 정한 기본 색 — 늘 같다", () => {
    const a = listColorOf("8f2c1d0e-0000-4000-8000-000000000001", null);
    expect(LIST_COLOR_KEYS).toContain(a);
    expect(listColorOf("8f2c1d0e-0000-4000-8000-000000000001", "red")).toBe(a);
  });
  it("색 이름 확인", () => {
    expect(isListColor("navy")).toBe(true);
    expect(isListColor("#ff0000")).toBe(false);
  });
});
