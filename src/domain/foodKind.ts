import type { Cuisine } from "./cuisine";

// 세부 업종 (51) — 판정 규칙은 DB 한 곳(food_kind_of, places.food_kind). 여기는 그림을 고르는 데만 쓴다
export const FOOD_KINDS = [
  "gukbap", "gopchang", "jokbal", "naengmyeon", "noodle", "dak", "jjigae", "seafood", "gogi", "baekban",
  "ramen", "donkatsu", "udon", "donburi", "sushi",
  "mala", "yangkkochi", "dimsum", "jjajang",
  "pizza", "burger", "steak", "pasta", "brunch",
  "pho", "thai", "curry",
  "gimbap", "tteokbokki", "chicken",
  "wine", "cocktail", "pocha", "beer",
  "icecream", "bakery", "dessert", "coffee",
] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];

// 업종 기본 그림 세트 — flat: 직접 그린 평면(B) · 3d: Fluent 입체(E, MIT). 바꾸려면 NEXT_PUBLIC_FOOD_ART 를 바꿔 다시 배포
export type FoodArtStyle = "flat" | "3d";
export const FOOD_ART: FoodArtStyle = process.env.NEXT_PUBLIC_FOOD_ART === "3d" ? "3d" : "flat";

function isFoodKind(v: string | null | undefined): v is FoodKind {
  return !!v && (FOOD_KINDS as readonly string[]).includes(v);
}

// 그림 주소 — 세부 업종이 없으면 업종(한식 · 일식 …) 기본 그림. 파일: public/food/{flat|3d}/
export function foodArtSrc(kind: string | null | undefined, cuisine: Cuisine, style: FoodArtStyle = FOOD_ART): string {
  const name = isFoodKind(kind) ? kind : cuisine;
  return style === "3d" ? `/food/3d/${name}.png` : `/food/flat/${name}.svg`;
}
