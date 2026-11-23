import { describe, expect, it } from "vitest";
import { cuisinePreference, groupRecommendations, raterWeight, scoreCandidate, type Candidate, type Rater } from "./eatScore";

const origin = { lat: 37.5, lng: 127.0 };
const near = { lat: 37.5005, lng: 127.0 }; // 약 55m

function cand(id: string, over: Partial<Candidate> = {}): Candidate {
  return { placeId: id, name: id, ...near, address: "서울 중구", cuisine: "korean", categoryName: "", myTier: null, raters: [], ...over };
}
const rater = (over: Partial<Rater> = {}): Rater => ({ userId: "u", nickname: "가", tier: "three", followed: false, overlap: 0, similarity: null, ...over });

describe("raterWeight", () => {
  it("나와 비슷하고 팔로잉인 사람의 3숟가락이 가장 무겁다", () => {
    const close = raterWeight(rater({ followed: true, overlap: 5, similarity: 1 }));
    const unknown = raterWeight(rater());
    const opposite = raterWeight(rater({ overlap: 5, similarity: 0 }));
    expect(close).toBeGreaterThan(unknown);
    expect(unknown).toBeGreaterThan(opposite);
  });
});

describe("scoreCandidate", () => {
  it("반경 밖 · 음식점 아님 · 근거 없음은 빼고, 이유를 붙인다", () => {
    expect(scoreCandidate(cand("far", { lat: 37.6, raters: [rater()] }), origin, 1000, {})).toBeNull();
    expect(scoreCandidate(cand("park", { cuisine: "nonFood", myTier: "wantToGo" }), origin, 1000, {})).toBeNull();
    expect(scoreCandidate(cand("none"), origin, 1000, {})).toBeNull();
    const s = scoreCandidate(cand("a", { myTier: "wantToGo", raters: [rater({ nickname: "단골", followed: true })] }), origin, 1000, {});
    expect(s?.reasons).toEqual(["내가 가고 싶은 곳", "단골 3숟가락 · 팔로잉"]);
  });
});

describe("groupRecommendations", () => {
  it("내가 좋아하는 업종 묶음이 먼저", () => {
    const groups = groupRecommendations(
      [cand("k", { raters: [rater()] }), cand("j", { cuisine: "japanese", raters: [rater()] })],
      origin,
      1000,
      { japanese: 1, korean: 0.2 },
    );
    expect(groups.map((g) => g.cuisine)).toEqual(["japanese", "korean"]);
  });
});

describe("cuisinePreference", () => {
  it("3숟가락에 더 무게, 가장 많은 업종이 1", () => {
    expect(cuisinePreference([
      { cuisine: "japanese", tier: "three" },
      { cuisine: "korean", tier: "two" },
      { cuisine: "korean", tier: "notRecommended" },
    ])).toEqual({ japanese: 1, korean: 1 / 1.5 });
  });
});
