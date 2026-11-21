export const CUISINES = [
  "korean",
  "chinese",
  "japanese",
  "western",
  "asian",
  "snack",
  "chicken",
  "bar",
  "cafe",
  "other",
  "nonFood",
] as const;

export type Cuisine = (typeof CUISINES)[number];

export const CUISINE_LABEL: Record<Cuisine, string> = {
  korean: "한식",
  chinese: "중식",
  japanese: "일식",
  western: "양식",
  asian: "아시아",
  snack: "분식",
  chicken: "치킨",
  bar: "술집",
  cafe: "카페",
  other: "기타",
  nonFood: "음식점 아님",
};

export type CuisineResult = {
  cuisine: Cuisine;
  // 음식점인데 표에 없는 분류 코드라 '기타'로 떨어졌는지
  unmapped: boolean;
};
