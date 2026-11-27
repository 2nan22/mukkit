import { describe, expect, it } from "vitest";
import { isRecapSeason, isRecapYear, pastRecapYear, recapYear, summarizeRecap, type RecapRow } from "./recap";

const row = (o: Partial<RecapRow>): RecapRow => ({
  placeId: o.placeId ?? Math.random().toString(36),
  name: o.name ?? "가게",
  tier: o.tier ?? "two",
  cuisine: o.cuisine ?? "korean",
  address: o.address ?? "서울특별시 마포구 양화로 1",
  ratedAt: o.ratedAt === undefined ? "2026-05-01T03:00:00Z" : o.ratedAt,
  savedAt: o.savedAt ?? "2026-05-01T03:00:00Z",
  tierRank: o.tierRank ?? null,
  isPrivate: o.isPrivate ?? false,
});

describe("결산 철 · 해", () => {
  it("12월은 올해, 1월은 지난해", () => {
    expect(recapYear(new Date("2026-12-10T03:00:00Z"))).toBe(2026);
    expect(recapYear(new Date("2027-01-10T03:00:00Z"))).toBe(2026);
  });
  it("12 · 1월만 결산 철 (한국 시간)", () => {
    expect(isRecapSeason(new Date("2026-11-30T14:59:00Z"))).toBe(false);
    expect(isRecapSeason(new Date("2026-11-30T15:00:00Z"))).toBe(true);
    expect(isRecapSeason(new Date("2027-02-01T03:00:00Z"))).toBe(false);
  });
  it("철이 지나면 지난 결산 — 결산을 낸 해부터", () => {
    expect(pastRecapYear(new Date("2026-11-20T03:00:00Z"))).toBeNull();
    expect(pastRecapYear(new Date("2027-01-20T03:00:00Z"))).toBeNull();
    expect(pastRecapYear(new Date("2027-03-01T03:00:00Z"))).toBe(2026);
  });
  it("열 수 있는 해 — 아직 안 온 결산 · 결산 전 해는 못 연다", () => {
    expect(isRecapYear(2026, new Date("2026-11-20T03:00:00Z"))).toBe(false);
    expect(isRecapYear(2026, new Date("2026-12-02T03:00:00Z"))).toBe(true);
    expect(isRecapYear(2026, new Date("2027-06-02T03:00:00Z"))).toBe(true);
    expect(isRecapYear(2027, new Date("2027-06-02T03:00:00Z"))).toBe(false);
    expect(isRecapYear(2025, new Date("2026-12-02T03:00:00Z"))).toBe(false);
  });
});

describe("summarizeRecap", () => {
  it("올해 등급을 매긴 곳만 세고 평가 전 · 가고 싶은 곳은 뺀다", () => {
    const r = summarizeRecap(
      [
        row({}),
        row({ ratedAt: "2025-12-31T14:00:00Z", savedAt: "2025-12-31T14:00:00Z" }),
        row({ ratedAt: "2025-12-31T16:00:00Z" }),
        row({ tier: "unrated", ratedAt: null }),
        row({ tier: "wantToGo", ratedAt: null }),
      ],
      2026,
    );
    expect(r.rated).toBe(2);
    expect(r.saved).toBe(4);
    expect(r.unrated).toBe(1);
    expect(r.full).toBe(false);
  });
  it("10곳부터 전체 카드", () => {
    expect(summarizeRecap(Array.from({ length: 10 }, () => row({})), 2026).full).toBe(true);
  });
  it("나만의 맛집 순위는 정한 순위대로 3곳, 순위가 없으면 뒤에 최근 것부터", () => {
    const r = summarizeRecap(
      [
        row({ tier: "three", name: "가", tierRank: 3 }),
        row({ tier: "three", name: "나", tierRank: 0 }),
        row({ tier: "three", name: "다", ratedAt: "2026-02-01T00:00:00Z" }),
        row({ tier: "three", name: "라", ratedAt: "2026-09-01T00:00:00Z" }),
      ],
      2026,
    );
    expect(r.ranking.map((p) => p.name)).toEqual(["나", "가", "라"]);
  });
  it("음식 · 동네는 두 곳 이상인 것만 상위 3, 기타 업종은 뺀다", () => {
    const r = summarizeRecap(
      [row({ cuisine: "japanese" }), row({ cuisine: "japanese" }), row({ cuisine: "chinese" }), row({ cuisine: "other" }), row({ cuisine: "other", address: "부산광역시 해운대구 1" })],
      2026,
    );
    expect(r.cuisines).toEqual([{ cuisine: "japanese", count: 2 }]);
    expect(r.regions).toEqual([{ region: "서울 마포구", count: 4 }]);
    expect(summarizeRecap([row({ cuisine: "japanese" })], 2026).cuisines).toEqual([]);
  });
});
