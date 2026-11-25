import { describe, expect, it } from "vitest";
import { isRecapSeason, recapYear, summarizeRecap, type RecapRow } from "./recap";

const row = (o: Partial<RecapRow>): RecapRow => ({
  placeId: o.placeId ?? Math.random().toString(36),
  name: o.name ?? "가게",
  tier: o.tier ?? "two",
  cuisine: o.cuisine ?? "korean",
  address: o.address ?? "서울특별시 마포구 양화로 1",
  updatedAt: o.updatedAt ?? "2026-05-01T03:00:00Z",
  savedAt: o.savedAt ?? "2026-05-01T03:00:00Z",
  tierRank: o.tierRank ?? null,
});

describe("recapYear · isRecapSeason", () => {
  it("12월은 올해, 1월은 지난해", () => {
    expect(recapYear(new Date("2026-12-10T03:00:00Z"))).toBe(2026);
    expect(recapYear(new Date("2027-01-10T03:00:00Z"))).toBe(2026);
  });
  it("12 · 1월만 결산 철 (한국 시간)", () => {
    expect(isRecapSeason(new Date("2026-11-30T14:59:00Z"))).toBe(false);
    expect(isRecapSeason(new Date("2026-11-30T15:00:00Z"))).toBe(true);
    expect(isRecapSeason(new Date("2027-02-01T03:00:00Z"))).toBe(false);
  });
});

describe("summarizeRecap", () => {
  it("올해 평가만 세고 평가 전 · 가고 싶은 곳은 뺀다", () => {
    const r = summarizeRecap(
      [row({}), row({ updatedAt: "2025-12-31T14:00:00Z", savedAt: "2025-12-31T14:00:00Z" }), row({ updatedAt: "2025-12-31T16:00:00Z" }), row({ tier: "unrated" }), row({ tier: "wantToGo" })],
      2026,
    );
    expect(r.rated).toBe(2);
    expect(r.saved).toBe(4);
  });
  it("올해의 3숟가락은 순위가 높은 곳, 순위가 없으면 최근 것", () => {
    const ranked = summarizeRecap([row({ tier: "three", name: "가", tierRank: 3 }), row({ tier: "three", name: "나", tierRank: 0 })], 2026);
    expect(ranked.best).toMatchObject({ name: "나", rank: 0, threeCount: 2 });
    const unranked = summarizeRecap([row({ tier: "three", name: "가", updatedAt: "2026-02-01T00:00:00Z" }), row({ tier: "three", name: "나", updatedAt: "2026-09-01T00:00:00Z" })], 2026);
    expect(unranked.best?.name).toBe("나");
  });
  it("음식 · 동네는 두 곳 이상일 때만, 기타 업종은 뺀다", () => {
    const r = summarizeRecap([row({ cuisine: "japanese" }), row({ cuisine: "japanese" }), row({ cuisine: "other" }), row({ cuisine: "other" }), row({ cuisine: "other", address: "부산광역시 해운대구 1" })], 2026);
    expect(r.cuisine).toEqual({ cuisine: "japanese", count: 2 });
    expect(r.region).toEqual({ region: "서울 마포구", count: 4 });
    expect(summarizeRecap([row({ cuisine: "japanese" })], 2026).cuisine).toBeNull();
  });
});
