import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "./paths";

describe("isProtectedPath", () => {
  it("보호 경로와 그 하위만 막는다", () => {
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/home/lists")).toBe(true);
    expect(isProtectedPath("/homework")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("외부 주소로는 보내지 않는다", () => {
    expect(safeNextPath("/home/lists")).toBe("/home/lists");
    expect(safeNextPath("https://evil.example")).toBe("/home");
    expect(safeNextPath("//evil.example")).toBe("/home");
    expect(safeNextPath("/\\evil.example")).toBe("/home");
    expect(safeNextPath(null)).toBe("/home");
  });
});
