import { describe, expect, it } from "vitest";
import { fromSupabaseProvider, isLoginProvider, toSupabaseProvider } from "./providers";

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

  it("Supabase identity 공급자 이름을 다시 경로 이름으로", () => {
    expect(fromSupabaseProvider("custom:naver")).toBe("naver");
    expect(fromSupabaseProvider("google")).toBe("google");
    expect(fromSupabaseProvider("email")).toBeUndefined();
  });
});
