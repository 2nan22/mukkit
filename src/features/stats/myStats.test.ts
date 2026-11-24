import { describe, expect, it } from "vitest";
import { summarizeStats, type StatRow } from "./myStats";

const r = (tier: StatRow["tier"], cuisine: StatRow["cuisine"], address = "서울특별시 성동구 성수동 1"): StatRow => ({ tier, cuisine, address });

describe("summarizeStats (68)", () => {
  it("숫자 셋 · 평가 전", () => {
    const s = summarizeStats([r("three", "japanese"), r("two", "korean"), r("unrated", "korean"), r("wantToGo", "cafe")]);
    expect(s).toMatchObject({ saved: 4, rated: 2, three: 1, unrated: 1 });
    expect(s.tiers.map((t) => t.count)).toEqual([1, 1, 0, 0]);
  });
  it("음식은 저장한 곳 전부 · 기타 빼고 상위 3", () => {
    const s = summarizeStats([r("unrated", "korean"), r("unrated", "korean"), r("three", "japanese"), r("one", "cafe"), r("one", "bar"), r("unrated", "other"), r("unrated", "other"), r("unrated", "other")]);
    expect(s.cuisines).toEqual([{ cuisine: "korean", count: 2 }, { cuisine: "bar", count: 1 }, { cuisine: "cafe", count: 1 }]);
  });
  it("동네는 평가한 곳만", () => {
    const s = summarizeStats([r("three", "korean"), r("two", "korean", "서울 마포구 서교동"), r("unrated", "korean", "서울 마포구 합정동"), r("wantToGo", "korean", "서울 마포구 망원동")]);
    expect(s.regions).toEqual([{ region: "서울 마포구", count: 1 }, { region: "서울 성동구", count: 1 }]);
  });
});
