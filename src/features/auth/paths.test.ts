import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "./paths";

describe("isProtectedPath", () => {
  it("보호 경로와 그 하위만 막는다", () => {
    expect(isProtectedPath("/home")).toBe(true);
    expect(isProtectedPath("/home/lists")).toBe(true);
    expect(isProtectedPath("/homework")).toBe(false);
    expect(isProtectedPath("/onboarding/nickname")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/meet/new")).toBe(true);
    expect(isProtectedPath("/m/abc")).toBe(false);
    expect(isProtectedPath("/l/abc")).toBe(false);
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

  it("탭 · 줄바꿈이 섞여 브라우저가 외부 주소로 풀 값은 거절한다", () => {
    for (const bad of ["/\t/evil.example", "/\n/evil.example", "/\r//evil.example"]) {
      expect(safeNextPath(bad)).toBe("/home");
      expect(new URL(safeNextPath(bad), "http://localhost").host).toBe("localhost");
    }
  });

  it("같은 사이트 경로는 검색어 · 조각까지 그대로 둔다", () => {
    expect(safeNextPath("/l/abc?x=1#top")).toBe("/l/abc?x=1#top");
    expect(safeNextPath("/onboarding/import")).toBe("/onboarding/import");
  });
});
