import { describe, expect, it } from "vitest";
import { compareScope } from "./RatingForm";
import type { RankPlace } from "@/features/rank/rank";

const p = (id: string, cuisine: RankPlace["cuisine"], rank: number): RankPlace => ({ placeId: id, name: id, address: "", cuisine, visitedOn: null, rank });

describe("compareScope (67-2)", () => {
  const ranked = [p("a", "korean", 1), p("b", "japanese", 2), p("c", "korean", 3), p("d", "japanese", 4)];
  it("같은 업종만 비교 · 자리는 전체 순위 기준", () => {
    const s = compareScope(p("t", "japanese", 0), ranked);
    expect(s.ranked.map((x) => x.placeId)).toEqual(["b", "d"]);
    expect(s.afterOf!(0)).toBe("a"); // 일식 1등(b)보다 좋으면 b 바로 위 = a 아래
    expect(s.afterOf!(1)).toBe("b");
    expect(s.afterOf!(2)).toBe("d");
  });
  it("같은 업종 1등이 전체 1등이면 맨 위", () => {
    expect(compareScope(p("t", "korean", 0), ranked).afterOf!(0)).toBeNull();
  });
  it("같은 업종이 없으면 전체와 비교", () => {
    const s = compareScope(p("t", "cafe", 0), ranked);
    expect(s.ranked).toHaveLength(4);
    expect(s.afterOf).toBeUndefined();
  });
});
