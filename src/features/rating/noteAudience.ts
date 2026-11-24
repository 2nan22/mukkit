import type { NoteVisibility, RatingVisibility } from "./rating";

const RANK: Record<RatingVisibility, number> = { private: 0, followers: 1, public: 2 };

// 메모를 실제로 볼 수 있는 범위 — 평가를 볼 수 있는 사람 중에서만이라 평가보다 넓어지지 않는다 (68-5)
export function effectiveNote(rating: RatingVisibility, note: NoteVisibility): RatingVisibility {
  if (note === "same") return rating;
  return RANK[note] < RANK[rating] ? note : rating;
}

// 메모를 누가 보는지 한 줄 — 고른 것보다 평가가 좁으면 그 까닭까지
export function noteAudience(rating: RatingVisibility, note: NoteVisibility): string {
  const eff = effectiveNote(rating, note);
  const capped = note !== "same" && eff !== note;
  if (eff === "private") return capped ? "평가가 나만이라 메모도 나만 봐요" : "나만 봐요";
  if (eff === "followers") return capped ? "평가가 팔로워 공개라 메모도 팔로워에게만 보여요" : "팔로워에게 보여요";
  return "누구나 볼 수 있어요";
}

// 내 평가 화면의 메모 이름표
export function noteLabel(rating: RatingVisibility, note: NoteVisibility): string {
  const eff = effectiveNote(rating, note);
  if (eff === "private") return "나만 보는 메모";
  return eff === "followers" ? "메모 · 팔로워에게 보임" : "메모 · 전체 공개";
}
