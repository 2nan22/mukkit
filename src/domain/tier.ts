export const TIERS = ["three", "two", "one", "notRecommended", "wantToGo", "unrated"] as const;

export type Tier = (typeof TIERS)[number];

export const TIER_LABEL: Record<Tier, string> = {
  three: "3숟가락",
  two: "2숟가락",
  one: "1숟가락",
  notRecommended: "추천 안 함",
  wantToGo: "가고 싶은 곳",
  unrated: "평가 전",
};

// 수저 개수로 높낮이 — 설명은 대표의 기준 그대로 (2026-11-23). 가게를 깎아내리는 말은 쓰지 않는다
export const TIER_MEANING: Record<Tier, string> = {
  three: "나만 알고 싶은 곳",
  two: "또 가도 좋고 권하기도 좋은 곳",
  one: "한 번으로 충분한 곳",
  notRecommended: "다시 가고 싶지 않은 곳",
  wantToGo: "아직 가보지 않은 곳",
  unrated: "저장만 하고 평가하지 않은 곳",
};

// 신뢰 통계(3숟가락 비율 등)에 들어가는 등급 — 평가 전 · 가고 싶은 곳은 평가가 아니다
export function isRated(tier: Tier): boolean {
  return tier === "three" || tier === "two" || tier === "one" || tier === "notRecommended";
}

// DB enum 값 — 화면 · 도메인은 Tier, 저장 · 조회 경계에서만 바꾼다
export const DB_TIERS = ["three", "two", "one", "not_recommended", "want_to_go", "unrated"] as const;
export type DbTier = (typeof DB_TIERS)[number];

export function tierToDb(tier: Tier): DbTier {
  return DB_TIERS[TIERS.indexOf(tier)];
}

export function tierFromDb(value: string): Tier {
  const i = DB_TIERS.indexOf(value as DbTier);
  if (i < 0) throw new Error(`알 수 없는 등급 값: ${value}`);
  return TIERS[i];
}
