import { describe, expect, it } from "vitest";
import { isLoginProvider, toSupabaseProvider } from "./providers";

describe("로그인 공급자", () => {
  it("목록에 있는 경로 이름만 통과", () => {
    expect(isLoginProvider("kakao")).toBe(true);
    expect(isLoginProvider("google")).toBe(true);
    expect(isLoginProvider("naver")).toBe(true);
    expect(isLoginProvider("github")).toBe(false);
    expect(isLoginProvider("toString")).toBe(false);
  });

  it("네이버는 커스텀 OIDC 공급자 이름으로 바뀐다", () => {
    expect(toSupabaseProvider("naver")).toBe("custom:naver");
    expect(toSupabaseProvider("kakao")).toBe("kakao");
  });
});
