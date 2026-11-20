import { describe, expect, it } from "vitest";
import { identityLabel, maskEmail } from "./identityLabel";

describe("maskEmail", () => {
  it("앞 두 글자만 남기고 도메인은 보인다", () => {
    expect(maskEmail("mango1234@gmail.com")).toBe("ma***@gmail.com");
    expect(maskEmail("ab@x.com")).toBe("a***@x.com");
    expect(maskEmail("a@x.com")).toBe("a***@x.com");
    expect(maskEmail("not-an-email")).toBe("");
  });
});

describe("identityLabel", () => {
  it("이메일이 있으면 가린 이메일, 없으면 연결한 날", () => {
    expect(identityLabel({ identity_data: { email: "mango@gmail.com" } })).toBe("ma***@gmail.com");
    expect(identityLabel({ identity_data: {}, created_at: "2026-11-20T05:00:00Z" })).toMatch(/^2026\.11\.2[01] 연결$/);
    expect(identityLabel({})).toBe("연결됨");
  });
});
