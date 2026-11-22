import { describe, expect, it } from "vitest";
import { candidateQuery, extractPlaceCandidates } from "./textPlaces";

describe("글에서 가게 후보 뽑기", () => {
  it("📍 이름 + 다음 줄 주소", () => {
    const text = `을지로 노포 국밥 다녀왔어요 🍲
국물이 진하고 고기가 많아요

📍을지로 영남순대국
📍서울 중구 다산로42길 19
⏰ 11:00 - 21:00

#을지로맛집 #국밥 #먹스타그램`;
    expect(extractPlaceCandidates(text)).toEqual([{ name: "을지로 영남순대국", address: "서울 중구 다산로42길 19" }]);
  });

  it("상호 · 주소 라벨", () => {
    const text = "상호: 오얏키친\n주소: 서울 마포구 성미산로 123\n메뉴: 규동";
    expect(extractPlaceCandidates(text)).toEqual([{ name: "오얏키친", address: "서울 마포구 성미산로 123" }]);
  });

  it("한 줄에 이름 | 주소", () => {
    expect(extractPlaceCandidates("📌 1.5닭갈비 본점 | 강원 춘천시 후석로 413")).toEqual([{ name: "1.5닭갈비 본점", address: "강원 춘천시 후석로 413" }]);
  });

  it("[가게] 여러 곳", () => {
    const text = "[물고기초밥]\n좋았던 곳\n[스프카레 츠바메]\n또 갈 곳";
    expect(extractPlaceCandidates(text).map((c) => c.name)).toEqual(["물고기초밥", "스프카레 츠바메"]);
  });

  it("표시가 없으면 해시태그 — 일반 태그 · 동네는 뺀다", () => {
    expect(extractPlaceCandidates("오늘 점심 #성수맛집 #성수동 #카페투어 #어니언 #내돈내산").map((c) => c.name)).toEqual(["어니언"]);
  });

  it("아무것도 없으면 빈 목록", () => {
    expect(extractPlaceCandidates("오늘 날씨 좋다")).toEqual([]);
  });

  it("검색어에 시 · 구를 붙임", () => {
    expect(candidateQuery({ name: "영남순대국", address: "서울 중구 다산로42길 19" })).toBe("서울 중구 영남순대국");
    expect(candidateQuery({ name: "어니언", address: null })).toBe("어니언");
  });
});
