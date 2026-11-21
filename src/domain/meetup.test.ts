import { describe, expect, it } from "vitest";
import type { Candidate } from "./eatScore";
import { areaReason, clock, endMinutesKst, lastDepartureMinutes, planAreaShops, purposeFit, rankAreas } from "./meetup";

const area = { lat: 37.5, lng: 127.0 };
function cand(id: string, cuisine: Candidate["cuisine"], extra: Partial<Candidate> = {}): Candidate {
  return { placeId: id, name: id, lat: 37.5005, lng: 127.0005, address: "", cuisine, categoryName: "", myTier: "two", raters: [], ...extra };
}

describe("planAreaShops", () => {
  it("목적에 안 맞는 음식 종류는 뺀다 — 카페 약속에 술집 없음", () => {
    const shops = planAreaShops([cand("bar", "bar"), cand("cafe", "cafe")], area, "cafe", {}, null);
    expect(shops.map((s) => s.placeId)).toEqual(["cafe"]);
  });

  it("같이 가는 사람이 좋게 본 곳이 위로, 이유 맨 앞", () => {
    const partner = { id: "p", nickname: "단골친구" };
    const withPartner = cand("b", "korean", { raters: [{ userId: "p", nickname: "단골친구", tier: "three", followed: true, overlap: 3, similarity: 0.9 }] });
    const shops = planAreaShops([cand("a", "korean"), withPartner], area, "meal", {}, partner);
    expect(shops[0].placeId).toBe("b");
    expect(shops[0].reasons[0]).toBe("같이 가는 단골친구님 3스타");
    expect(shops[0].reasons.filter((r) => r.startsWith("단골친구 "))).toHaveLength(0);
  });

  it("지역 반경 밖 · 근거 없는 곳은 빼고 최대 4곳", () => {
    const far = cand("far", "korean", { lat: 37.6 });
    const none = cand("none", "korean", { myTier: null });
    const many = Array.from({ length: 6 }, (_, i) => cand(`k${i}`, "korean"));
    const shops = planAreaShops([far, none, ...many], area, "meal", {}, null);
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
  it("시간이 비슷하면 '두 분 모두', 차이가 크면 각자", () => {
    expect(areaReason(28, 33)).toBe("두 분 모두 약 30분");
    expect(areaReason(15, 45)).toBe("나 약 15분 · 상대 약 45분");
  });
});

describe("막차 어림 · rankAreas", () => {
  const base = { lat: 0, lng: 0, recent: 0 };
  it("귀가가 길수록 일찍", () => {
    expect(clock(lastDepartureMinutes(20))).toBe("00:20");
    expect(clock(lastDepartureMinutes(50))).toBe("23:50");
    expect(clock(lastDepartureMinutes(120))).toBe("22:50");
  });
  it("새벽 0시 30분 종료는 전날 밤의 연장 (24:30)", () => {
    expect(endMinutesKst(new Date("2026-11-21T15:30:00Z"))).toBe(24 * 60 + 30);
  });
  it("늦게 끝나면 막차를 넘기는 사람이 적은 지역이 먼저", () => {
    const far = { ...base, name: "먼 곳", myMinutes: 20, partnerMinutes: 20, myReturn: 80, partnerReturn: 80 };
    const near = { ...base, name: "귀가 가까운 곳", myMinutes: 30, partnerMinutes: 30, myReturn: 25, partnerReturn: 25 };
    const endsAt = new Date("2026-11-21T14:40:00Z"); // 23:40 KST
    const [first] = rankAreas([far, near], endsAt);
    expect(first.name).toBe("귀가 가까운 곳");
    const farRanked = rankAreas([far], endsAt)[0];
    expect(farRanked.myLate).toBe(true);
    expect(farRanked.myLast).toBe("23:20");
  });
  it("끝나는 시각이 없으면 더 먼 쪽이 짧은 순", () => {
    const a = { ...base, name: "a", myMinutes: 40, partnerMinutes: 10, myReturn: null, partnerReturn: null };
    const b = { ...base, name: "b", myMinutes: 25, partnerMinutes: 25, myReturn: null, partnerReturn: null };
    expect(rankAreas([a, b], null)[0].name).toBe("b");
  });
});
