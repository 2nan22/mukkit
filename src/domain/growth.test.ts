import { describe, expect, it } from "vitest";
import { branchOf, growthTotal, levelOf, nextHint, pointsForLevel, type GrowthCounts } from "./growth";

const none: GrowthCounts = { ratings: 0, reviews: 0, media: 0, areas: 0, kinds: 0, ranked: 0, likesPoints: 0, listSaves: 0, visits: 0, imported: false, topKind: null, character: null };

describe("growthTotal", () => {
  it("평가는 50곳까지 10점, 그 뒤 3점", () => {
    expect(growthTotal({ ...none, ratings: 50 })).toBe(500);
    expect(growthTotal({ ...none, ratings: 60 })).toBe(530);
  });
  it("사진 · 한 줄 평가 · 동네 · 업종 · 첫 가져오기를 더한다", () => {
    expect(growthTotal({ ...none, ratings: 2, reviews: 1, media: 2, areas: 1, kinds: 2, imported: true })).toBe(20 + 5 + 10 + 20 + 30 + 30);
  });
});

describe("levelOf", () => {
  it("곡선 25·L·(L−1) 경계", () => {
    expect(pointsForLevel(10)).toBe(2250);
    expect(levelOf(0)).toMatchObject({ level: 1, stage: 1, into: 0, need: 50 });
    expect(levelOf(49).level).toBe(1);
    expect(levelOf(50).level).toBe(2);
    expect(levelOf(2250)).toMatchObject({ level: 10, stage: 2 });
  });
  it("6레벨마다 단계 · 30레벨이 끝", () => {
    expect(levelOf(pointsForLevel(7)).stage).toBe(2);
    expect(levelOf(pointsForLevel(25)).stage).toBe(5);
    expect(levelOf(10_000_000)).toMatchObject({ level: 30, max: true, need: 0 });
  });
});

describe("branchOf", () => {
  it("4단계부터 국물 · 빵 쪽이면 갈림 · 그 밖은 기본 모습", () => {
    expect(branchOf("gukbap", 3)).toBeNull();
    expect(branchOf("gukbap", 4)).toBe("soup");
    expect(branchOf("coffee", 5)).toBe("bread");
    expect(branchOf("gogi", 5)).toBeNull();
    expect(branchOf(null, 5)).toBeNull();
  });
});

describe("nextHint", () => {
  it("평가가 없으면 가져오기 · 평가부터", () => {
    expect(nextHint(none, levelOf(0))).toBe("저장해 둔 맛집을 가져와 평가해 보세요");
  });
  it("사진이 적으면 사진 있는 평가 수를 알려 준다", () => {
    const c = { ...none, ratings: 10, reviews: 10 };
    expect(nextHint(c, levelOf(growthTotal(c)))).toMatch(/^사진 있는 평가 \d+곳이면 레벨 업$/);
  });
});
