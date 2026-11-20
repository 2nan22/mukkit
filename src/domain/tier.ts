export const TIERS = ["three", "two", "one", "notRecommended", "wantToGo", "unrated"] as const;

export type Tier = (typeof TIERS)[number];

export const TIER_LABEL: Record<Tier, string> = {
  three: "3스타",
  two: "2스타",
  one: "1스타",
  notRecommended: "추천 안 함",
  wantToGo: "가고 싶은 곳",
  unrated: "평가 전",
};

export const TIER_MEANING: Record<Tier, string> = {
  three: "일부러 찾아갈 곳",
  two: "근처라면 들를 곳",
  one: "무난한 곳",
  notRecommended: "다시 안 갈 곳",
  wantToGo: "아직 안 가본 곳",
  unrated: "저장만 하고 평가하지 않은 곳",
};

// 신뢰 통계(3스타 비율 등)에 들어가는 등급 — 평가 전 · 가고 싶은 곳은 평가가 아니다
export function isRated(tier: Tier): boolean {
  return tier === "three" || tier === "two" || tier === "one" || tier === "notRecommended";
}
