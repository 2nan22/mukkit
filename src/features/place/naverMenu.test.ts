import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {} }));
const { parseNaverMenu } = await import("./menu");

// 네이버 모바일 장소 페이지 안 데이터 묶음 형식 (2026-11 확인)
const html = `<script>window.__APOLLO_STATE__ = ${JSON.stringify({
  "PlaceMenuItem:a": { __typename: "PlaceMenuItem", name: "버섯칼국수", description: "버섯매운탕 + 칼국수", badges: ["repr"], price: { __typename: "PlaceMenuPrice", displayText: "12,000원" } },
  "PlaceMenuItem:b": { __typename: "PlaceMenuItem", name: "공기밥", description: null, badges: [], price: { displayText: "변동" } },
  "PlaceDetailBase:1": { __typename: "PlaceDetailBase", name: "가게" },
})};window.__PLACE_STATE__ = {};</script>`;

describe("parseNaverMenu", () => {
  it("메뉴 이름 · 가격 · 설명 · 대표만 꺼낸다", () => {
    expect(parseNaverMenu(html)).toEqual([
      { name: "버섯칼국수", price: 12000, description: "버섯매운탕 + 칼국수", recommended: true },
      { name: "공기밥", price: null, description: "", recommended: false },
    ]);
  });

  it("데이터 묶음이 없으면 빈 목록", () => {
    expect(parseNaverMenu("<html></html>")).toEqual([]);
  });
});
