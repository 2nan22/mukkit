import { describe, expect, it } from "vitest";
import { EMPTY_CRITERIA, matchPlaces } from "./criteria";
import type { PickablePlace } from "./pickablePlaces";

function place(id: string, over: Partial<PickablePlace>): PickablePlace {
  return {
    placeId: id, name: id, lat: 0, lng: 0, address: "서울 중구 을지로", cuisine: "korean", categoryName: "", available: true,
    tier: "unrated", note: "", links: [], origins: [], ...over,
  };
}

const places = [
  place("a", { address: "서울 영등포구 여의대로", origins: [{ source: "naver", listKey: "naver:2", listName: "난슐랭 2star", memo: "점심 정식" }] }),
  place("b", { address: "서울 영등포구 국제금융로", cuisine: "japanese", origins: [{ source: "kakao", listKey: "kakao:1", listName: "먹킷리스트", memo: "" }] }),
  place("c", { address: "서울 중구 을지로", origins: [{ source: "naver", listKey: "naver:3", listName: "난슐랭 3star", memo: "" }], note: "점심 혼밥" }),
];

const ids = (ps: PickablePlace[]) => ps.map((p) => p.placeId);

describe("matchPlaces", () => {
  it("묶음 안에서는 하나라도, 묶음끼리는 모두", () => {
    expect(ids(matchPlaces(places, { ...EMPTY_CRITERIA, regions: ["서울 영등포구"] }))).toEqual(["a", "b"]);
    expect(ids(matchPlaces(places, { ...EMPTY_CRITERIA, labels: ["naver:2", "kakao:1"] }))).toEqual(["a", "b"]);
    expect(ids(matchPlaces(places, { ...EMPTY_CRITERIA, regions: ["서울 영등포구"], cuisines: ["japanese"] }))).toEqual(["b"]);
  });

  it("테마 낱말은 이름 · 메모 · 원래 메모에서 찾는다", () => {
    expect(ids(matchPlaces(places, { ...EMPTY_CRITERIA, keyword: "점심" }))).toEqual(["a", "c"]);
  });

  it("조건이 없으면 전부", () => {
    expect(matchPlaces(places, EMPTY_CRITERIA)).toHaveLength(3);
  });
});
