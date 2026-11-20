import { describe, expect, it } from "vitest";
import { NicknameSchema, suggestNickname } from "./nickname";

describe("NicknameSchema", () => {
  it("한글 · 영문 · 숫자 · 밑줄 2~12자만 허용하고 앞뒤 공백은 지운다", () => {
    expect(NicknameSchema.parse("  맛집탐험가 ")).toBe("맛집탐험가");
    expect(NicknameSchema.safeParse("ab_12").success).toBe(true);
    expect(NicknameSchema.safeParse("가").success).toBe(false);
    expect(NicknameSchema.safeParse("열세글자가넘는닉네임입니다요").success).toBe(false);
    expect(NicknameSchema.safeParse("맛집 탐험가").success).toBe(false);
    expect(NicknameSchema.safeParse("hi!").success).toBe(false);
  });
});

describe("suggestNickname", () => {
  it("공급자 이름 중 규칙에 맞는 첫 값을 공백 없이 제안", () => {
    expect(suggestNickname({ full_name: "Kim Mango", name: "김 망고" })).toBe("김망고");
    expect(suggestNickname({ name: "!!!" })).toBe("");
    expect(suggestNickname(undefined)).toBe("");
  });
});
