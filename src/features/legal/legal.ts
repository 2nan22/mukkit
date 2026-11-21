// 약관 · 처리방침 버전 — 내용이 바뀌면 올리고, 이전 버전에 동의한 사람은 다시 동의를 받는다
export const TERMS_VERSION = "2026-11-22";
export const EFFECTIVE_DATE = "2026년 11월 22일";

// 문의처 — 공개 출시 전에 실제 주소를 넣는다
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function needsAgreement(profile: { terms_version: string | null } | null): boolean {
  return !profile || profile.terms_version !== TERMS_VERSION;
}
