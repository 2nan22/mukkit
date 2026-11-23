// 키우는 캐릭터 · 레벨 (63) — 점수 규칙 한 곳. 개수는 DB my_growth() 가 지금 남은 기록에서 센다
// 양보다 기록의 질 · 넓이: 평가는 50곳이 넘으면 덜 주고, 사진 · 한 줄 평가 · 처음 간 동네 · 업종에 더 준다

export type GrowthCounts = {
  ratings: number;
  reviews: number;
  media: number;
  areas: number;
  kinds: number;
  ranked: number;
  likesPoints: number;
  listSaves: number;
  visits: number;
  imported: boolean;
  topKind: string | null;
};

export const POINTS = {
  rating: 10,
  // 50곳이 넘으면 한 곳에 3점 — 개수 경쟁으로 평가가 부풀지 않게
  ratingAfterCap: 3,
  ratingCap: 50,
  review: 5,
  media: 5,
  area: 20,
  kind: 15,
  ranked: 10,
  listSave: 10,
  visit: 10,
  firstImport: 30,
} as const;

export type GrowthItem = { key: keyof typeof ITEM_LABEL; points: number };

export const ITEM_LABEL = {
  rating: "평가",
  review: "한 줄 평가",
  media: "사진",
  area: "다녀온 동네",
  kind: "먹어 본 메뉴 종류",
  ranked: "맛집 순위",
  likes: "받은 좋아요",
  listSave: "내 리스트 저장",
  visit: "함께 간 기록",
  firstImport: "첫 가져오기",
} as const;

export function growthItems(c: GrowthCounts): GrowthItem[] {
  const ratingPoints = Math.min(c.ratings, POINTS.ratingCap) * POINTS.rating + Math.max(0, c.ratings - POINTS.ratingCap) * POINTS.ratingAfterCap;
  return [
    { key: "rating", points: ratingPoints },
    { key: "review", points: c.reviews * POINTS.review },
    { key: "media", points: c.media * POINTS.media },
    { key: "area", points: c.areas * POINTS.area },
    { key: "kind", points: c.kinds * POINTS.kind },
    { key: "ranked", points: c.ranked * POINTS.ranked },
    { key: "likes", points: c.likesPoints },
    { key: "listSave", points: c.listSaves * POINTS.listSave },
    { key: "visit", points: c.visits * POINTS.visit },
    { key: "firstImport", points: c.imported ? POINTS.firstImport : 0 },
  ];
}

export function growthTotal(c: GrowthCounts): number {
  return growthItems(c).reduce((n, i) => n + i.points, 0);
}

export const MAX_LEVEL = 30;
// 6레벨마다 캐릭터가 한 단계 자란다 (1 ~ 5단계)
export const LEVELS_PER_STAGE = 6;

// 레벨 L 까지 필요한 누적 점수 — 25·L·(L−1): 2레벨 50점, 10레벨 2,250점, 20레벨 9,500점
export function pointsForLevel(level: number): number {
  return 25 * level * (level - 1);
}

export type Level = { level: number; stage: number; into: number; need: number; max: boolean };

export function levelOf(total: number): Level {
  let level = 1;
  while (level < MAX_LEVEL && total >= pointsForLevel(level + 1)) level++;
  const max = level === MAX_LEVEL;
  const base = pointsForLevel(level);
  return {
    level,
    stage: Math.min(5, Math.floor((level - 1) / LEVELS_PER_STAGE) + 1),
    into: total - base,
    need: max ? 0 : pointsForLevel(level + 1) - base,
    max,
  };
}

// 4단계부터 많이 평가한 메뉴 종류로 모습이 갈린다
export const BRANCHES = ["soup", "meat", "noodle", "bread", "drink", "world"] as const;
export type Branch = (typeof BRANCHES)[number];

export const BRANCH_LABEL: Record<Branch, string> = {
  soup: "국물파",
  meat: "고기파",
  noodle: "면파",
  bread: "빵 · 커피파",
  drink: "한잔파",
  world: "세계 음식파",
};

const KIND_BRANCH: Record<string, Branch> = {
  gukbap: "soup", jjigae: "soup", seafood: "soup", baekban: "soup", dak: "soup",
  gogi: "meat", gopchang: "meat", jokbal: "meat", chicken: "meat", steak: "meat", yangkkochi: "meat",
  noodle: "noodle", naengmyeon: "noodle", ramen: "noodle", udon: "noodle", jjajang: "noodle", pho: "noodle", pasta: "noodle",
  bakery: "bread", dessert: "bread", coffee: "bread", icecream: "bread", brunch: "bread",
  wine: "drink", cocktail: "drink", pocha: "drink", beer: "drink",
};

export function branchOf(topKind: string | null, stage: number): Branch | null {
  if (stage < 4 || !topKind) return null;
  return KIND_BRANCH[topKind] ?? "world";
}

// 다음 레벨까지 무엇을 하면 되는지 한 줄 — 점수가 큰 것보다 지금 할 수 있는 것부터
export function nextHint(c: GrowthCounts, lv: Level): string {
  if (lv.max) return "최고 레벨이에요";
  const left = lv.need - lv.into;
  if (c.ratings === 0) return c.imported ? "가져온 곳 중 다녀온 곳을 평가해 보세요" : "저장해 둔 맛집을 가져와 평가해 보세요";
  if (c.media < c.ratings / 3) return `사진 있는 평가 ${Math.max(1, Math.ceil(left / (POINTS.rating + POINTS.media)))}곳이면 레벨 업`;
  if (c.reviews < c.ratings / 2) return `한 줄 평가를 남긴 평가 ${Math.max(1, Math.ceil(left / (POINTS.rating + POINTS.review)))}곳이면 레벨 업`;
  return `처음 가는 동네에서 ${Math.max(1, Math.ceil(left / (POINTS.area + POINTS.rating)))}곳 평가하면 레벨 업`;
}
