import { describe, expect, it } from "vitest";
import { DB_TIERS, TIERS, tierFromDb, tierToDb } from "./tier";

describe("등급 값 변환", () => {
  it("도메인 ↔ DB 값이 짝을 이룬다", () => {
    expect(tierToDb("notRecommended")).toBe("not_recommended");
    expect(tierToDb("wantToGo")).toBe("want_to_go");
    expect(tierFromDb("want_to_go")).toBe("wantToGo");
    for (const t of TIERS) expect(tierFromDb(tierToDb(t))).toBe(t);
    expect(DB_TIERS).toHaveLength(TIERS.length);
  });

  it("모르는 값은 거부", () => {
    expect(() => tierFromDb("four")).toThrow();
  });
});
