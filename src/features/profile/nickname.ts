import { z } from "zod";

// 닉네임 규칙 한 곳 — DB 는 길이(2~12)와 중복만 막고, 글자 종류는 여기서 막는다
export const NICKNAME_RULE = "한글 · 영문 · 숫자 · 밑줄(_)로 2~12자";

export const NicknameSchema = z
  .string()
  .trim()
  .min(2, "2자 이상 입력해 주세요")
  .max(12, "12자 이하로 입력해 주세요")
  .regex(/^[가-힣a-zA-Z0-9_]+$/, "한글 · 영문 · 숫자 · 밑줄(_)만 쓸 수 있어요");

// 공급자가 준 이름을 제안값으로 — 규칙에 안 맞으면 제안하지 않는다
export function suggestNickname(metadata: Record<string, unknown> | undefined): string {
  const candidates = [metadata?.nickname, metadata?.name, metadata?.full_name, metadata?.user_name];
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const compact = value.replace(/\s+/g, "");
    if (NicknameSchema.safeParse(compact).success) return compact;
  }
  return "";
}
