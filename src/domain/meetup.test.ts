import { describe, expect, it } from "vitest";
import type { Candidate } from "./eatScore";
import { areaReason, planAreaShops, purposeFit } from "./meetup";

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
