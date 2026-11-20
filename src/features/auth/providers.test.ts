import { describe, expect, it } from "vitest";
import { isLoginProvider } from "./providers";

describe("isLoginProvider", () => {
  it("목록에 있는 공급자만 통과", () => {
    expect(isLoginProvider("kakao")).toBe(true);
    expect(isLoginProvider("google")).toBe(true);
    expect(isLoginProvider("github")).toBe(false);
    expect(isLoginProvider("")).toBe(false);
  });
});
