import type { RatingVisibility } from "./rating";

// 메모를 실제로 누가 보는지 — 스위치만 켜고 공개 범위가 나만이면 아무도 못 본다 (68-4 디자인 검토)
export function noteAudience(visibility: RatingVisibility, on: boolean): string {
  if (!on) return "나만 봐요";
  if (visibility === "private") return "지금은 공개 범위가 나만이라 아무도 못 봐요";
  return visibility === "followers" ? "팔로워에게 보여요" : "누구나 볼 수 있어요";
}

// 남에게 보이는 메모의 이름표 — 내 평가 화면에서
export function noteLabel(visibility: RatingVisibility, on: boolean): string {
  if (!on || visibility === "private") return "나만 보는 메모";
  return visibility === "followers" ? "메모 · 팔로워에게 보임" : "메모 · 전체 공개";
}
