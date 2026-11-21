import { describe, expect, it } from "vitest";
import type { Candidate } from "./eatScore";
import { areaReason, clock, endMinutesKst, lastDepartureMinutes, nightClock, planAreaShops, purposeFit, rankAreas, type AreaPerson, type AreaScore } from "./meetup";

const area = { lat: 37.5, lng: 127.0 };
function cand(id: string, cuisine: Candidate["cuisine"], extra: Partial<Candidate> = {}): Candidate {
  return { placeId: id, name: id, lat: 37.5005, lng: 127.0005, address: "", cuisine, categoryName: "", myTier: "two", raters: [], ...extra };
}
const person = (id: string, minutes: number, ret: number | null = null, isMe = false): AreaPerson => ({ id, nickname: id, isMe, minutes, return: ret });

describe("planAreaShops", () => {
  it("목적에 안 맞는 음식 종류는 뺀다 — 카페 약속에 술집 없음", () => {
    const shops = planAreaShops([cand("bar", "bar"), cand("cafe", "cafe")], area, "cafe", {}, []);
    expect(shops.map((s) => s.placeId)).toEqual(["cafe"]);
  });

  it("같이 가는 사람(여럿)이 좋게 본 곳이 위로, 이유 맨 앞", () => {
    const companions = [{ id: "p", nickname: "단골친구" }, { id: "q", nickname: "미식가" }];
    const rated = cand("b", "korean", {
      raters: [
        { userId: "p", nickname: "단골친구", tier: "three", followed: true, overlap: 3, similarity: 0.9 },
        { userId: "q", nickname: "미식가", tier: "two", followed: true, overlap: 3, similarity: 0.9 },
      ],
    });
    const shops = planAreaShops([cand("a", "korean"), rated], area, "meal", {}, companions);
    expect(shops[0].placeId).toBe("b");
    expect(shops[0].reasons[0]).toBe("같이 가는 단골친구님 3스타 · 미식가님 2스타");
    expect(shops[0].reasons.filter((r) => r.startsWith("단골친구 ") || r.startsWith("미식가 "))).toHaveLength(0);
  });

  it("지역 반경 밖 · 근거 없는 곳은 빼고 최대 4곳", () => {
    const far = cand("far", "korean", { lat: 37.6 });
    const none = cand("none", "korean", { myTier: null });
    const many = Array.from({ length: 6 }, (_, i) => cand(`k${i}`, "korean"));
    const shops = planAreaShops([far, none, ...many], area, "meal", {}, []);
    expect(shops).toHaveLength(4);
    expect(shops.map((s) => s.placeId)).not.toContain("far");
    expect(shops.map((s) => s.placeId)).not.toContain("none");
  });
});

describe("purposeFit · areaReason", () => {
  it("술 약속은 술집이 1, 카페는 낮음", () => {
    expect(purposeFit("drinks", "bar")).toBe(1);
    expect(purposeFit("drinks", "cafe")).toBeLessThan(0.3);
  });
  it("두 사람: 비슷하면 '두 사람 모두', 다르면 나 먼저", () => {
    expect(areaReason([person("나", 28, null, true), person("단골", 33)])).toBe("두 사람 모두 30분쯤");
    expect(areaReason([person("단골", 45), person("나", 15, null, true)])).toBe("나 15분쯤 · 단골님 45분쯤");
  });
  it("여러 명: 비슷하면 'N명 모두', 다르면 가장 먼 사람 · 평균", () => {
    expect(areaReason([person("a", 28), person("b", 30), person("c", 33)])).toBe("3명 모두 30분쯤");
    expect(areaReason([person("a", 15), person("b", 20), person("c", 50)])).toBe("가장 먼 c님 50분쯤 · 평균 30분");
  });
  it("막차 시각을 밤 표기로", () => {
    expect(nightClock("23:50")).toBe("밤 11:50");
    expect(nightClock("00:20")).toBe("밤 12:20");
  });
});

describe("막차 예상 · rankAreas", () => {
  const areaOf = (name: string, people: AreaPerson[]): AreaScore => ({
    name, lat: 0, lng: 0, people, recent: 0,
    maxMinutes: Math.max(...people.map((p) => p.minutes)),
    avgMinutes: people.reduce((a, p) => a + p.minutes, 0) / people.length,
  });
  it("귀가가 길수록 일찍", () => {
    expect(clock(lastDepartureMinutes(20))).toBe("00:20");
    expect(clock(lastDepartureMinutes(50))).toBe("23:50");
    expect(clock(lastDepartureMinutes(120))).toBe("22:50");
  });
  it("새벽 0시 30분 종료는 전날 밤의 연장 (24:30)", () => {
    expect(endMinutesKst(new Date("2026-11-21T15:30:00Z"))).toBe(24 * 60 + 30);
  });
  it("늦게 끝나면 막차를 넘기는 사람이 적은 지역이 먼저", () => {
    const far = areaOf("먼 곳", [person("a", 20, 80), person("b", 20, 80), person("c", 20, 25)]);
    const near = areaOf("귀가 가까운 곳", [person("a", 30, 25), person("b", 30, 25), person("c", 30, 25)]);
    const endsAt = new Date("2026-11-21T14:40:00Z"); // 23:40 KST
    const [first] = rankAreas([far, near], endsAt);
    expect(first.name).toBe("귀가 가까운 곳");
    const farRanked = rankAreas([far], endsAt)[0];
    expect(farRanked.lateCount).toBe(2);
    expect(farRanked.people[0].last).toBe("23:20");
  });
  it("헤어지는 시각이 없으면 가장 먼 사람이 짧은 순", () => {
    const a = areaOf("a", [person("x", 40), person("y", 10)]);
    const b = areaOf("b", [person("x", 25), person("y", 25)]);
    expect(rankAreas([a, b], null)[0].name).toBe("b");
  });
});
