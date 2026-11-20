import { CUISINES, type Cuisine, type CuisineResult } from "@/domain/cuisine";

// 네이버 cidPath 1단계 '음식점' 코드
const FOOD_ROOT = "220036";

// cidPath 2단계 코드 → 음식 종류. 코드 이름은 네이버가 주지 않아 가게 이름 표본으로 판정 (근거는 Vault)
const SECOND_LEVEL: Record<string, Cuisine> = {
  "220037": "korean",
  "220038": "japanese",
  "220039": "chinese",
  "220041": "asian",
  "220043": "asian",
  "220044": "western",
  "220048": "snack",
  "220049": "chicken",
  "220051": "bar",
  "220052": "cafe",
};

export function naverCuisineOf(categoryPath: string[]): CuisineResult {
  const [root, second] = categoryPath;
  if (root !== FOOD_ROOT) return { cuisine: "nonFood", unmapped: false };
  const cuisine = second ? SECOND_LEVEL[second] : undefined;
  return cuisine ? { cuisine, unmapped: false } : { cuisine: "other", unmapped: true };
}

export type CuisineSummary = {
  counts: Record<Cuisine, number>;
  foodCount: number;
  unmappedCount: number;
  unmappedCodes: string[];
};

export function summarizeNaverCuisines(paths: string[][]): CuisineSummary {
  const counts = Object.fromEntries(CUISINES.map((c) => [c, 0])) as Record<Cuisine, number>;
  const unmappedCodes = new Set<string>();
  let unmappedCount = 0;

  for (const path of paths) {
    const { cuisine, unmapped } = naverCuisineOf(path);
    counts[cuisine] += 1;
    if (unmapped) {
      unmappedCount += 1;
      unmappedCodes.add(path.slice(0, 2).join(">"));
    }
  }
  return {
    counts,
    foodCount: paths.length - counts.nonFood,
    unmappedCount,
    unmappedCodes: [...unmappedCodes],
  };
}
