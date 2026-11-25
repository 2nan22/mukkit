// 약관 · 처리방침 버전 — 내용이 바뀌면 올리고, 이전 버전에 동의한 사람은 다시 동의를 받는다
// 2026-11-27: 제6조 메모 공개 범위 (68-5 메모 공개 범위에 맞춤) — 옛 값(2026-11-26)보다 뒤 날짜로
export const TERMS_VERSION = "2026-11-27";
export const EFFECTIVE_DATE = "2026년 11월 25일";

// 운영자 · 문의처 — 공개 출시 전에 실제 값을 넣는다 (비어 있으면 해당 줄을 숨김)
export const OPERATOR_NAME = process.env.NEXT_PUBLIC_OPERATOR_NAME ?? "";
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "";

export function needsAgreement(profile: { terms_version: string | null } | null): boolean {
  return !profile || profile.terms_version !== TERMS_VERSION;
}

// 동의 화면에서 보낸 항목을 모두 체크했는지 — agree_items 에 적힌 항목마다 agree_<항목>=on (70-6)
// 항목 목록이 비었거나 모르는 항목이면 동의 안 한 것으로 본다
const AGREE_ITEMS = new Set(["age", "terms", "privacy"]);
export function agreedAll(formData: FormData, required: string[] = ["terms"]): boolean {
  const items = String(formData.get("agree_items") ?? "").split(",").filter(Boolean);
  if (!items.length || items.some((i) => !AGREE_ITEMS.has(i))) return false;
  if (required.some((r) => !items.includes(r))) return false;
  return items.every((i) => formData.get(`agree_${i}`) === "on");
}
