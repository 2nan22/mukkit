import type { Cuisine, CuisineResult } from "@/domain/cuisine";

// 카카오 업종 이름 1단계 '음식점' · 2단계 → 음식 종류
const FOOD_ROOT = "음식점";
const SECOND_LEVEL: Record<string, Cuisine> = {
  한식: "korean",
  일식: "japanese",
  중식: "chinese",
  양식: "western",
  아시아음식: "asian",
  분식: "snack",
  치킨: "chicken",
  술집: "bar",
  카페: "cafe",
  간식: "cafe",
};

export function kakaoCuisineOf(categoryPath: string[]): CuisineResult {
  const [root, second] = categoryPath;
  if (root !== FOOD_ROOT) return { cuisine: "nonFood", unmapped: false };
  const cuisine = second ? SECOND_LEVEL[second] : undefined;
  return cuisine ? { cuisine, unmapped: false } : { cuisine: "other", unmapped: true };
}
