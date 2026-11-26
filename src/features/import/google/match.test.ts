import { describe, expect, it } from "vitest";
import type { KakaoHit } from "@/features/search/kakaoLocal";
import { pickHit, searchQuery } from "./match";

const hit = (id: string, name: string, lat: number, lng: number, group = "FD6"): KakaoHit => ({
  id, name, lat, lng, group, address: "", categoryPath: [], categoryName: "", cuisine: "korean", distance: null,
});

describe("구글 항목 → 카카오 가게", () => {
  it("좌표가 있으면 가까운 같은 이름 · 이름이 조금 달라도(지점명) 근처면", () => {
    const item = { name: "소문난국밥 성수점", note: "", url: "", lat: 37.5446, lng: 127.0559 };
    const hits = [hit("far", "소문난국밥 성수점", 37.6, 127.1), hit("near", "소문난 국밥 성수점", 37.5447, 127.056)];
    expect(pickHit(item, hits)).toEqual({ hit: hits[1] });
    expect(pickHit({ ...item, name: "소문난국밥" }, [hit("a", "소문난국밥 성수점", 37.5447, 127.056)])).toMatchObject({ hit: { id: "a" } });
  });

  it("좌표가 있는데 300m 안에 없으면 못 찾음", () => {
    expect(pickHit({ name: "가게", note: "", url: "", lat: 37.5, lng: 127 }, [hit("x", "가게", 37.6, 127)])).toEqual({ reason: "not_found" });
  });

  it("좌표가 없으면 같은 이름이 한 곳뿐일 때만", () => {
    const item = { name: "온도", note: "", url: "" };
    expect(pickHit(item, [hit("1", "온도", 37.5, 127)])).toMatchObject({ hit: { id: "1" } });
    // 이름이 비슷하기만 하면 고르지 않는다
    expect(pickHit(item, [hit("1", "온도카페", 37.5, 127)])).toEqual({ reason: "not_found" });
  });

  it("같은 이름이 여럿(체인)이면 못 정함 — 내 장소에 하나만 있으면 그곳", () => {
    const item = { name: "스타벅스 성수역점", note: "", url: "" };
    const hits = [hit("1", "스타벅스 성수역점", 37.5, 127, "CE7"), hit("2", "스타벅스 성수역점", 37.51, 127, "CE7")];
    expect(pickHit(item, hits)).toEqual({ reason: "ambiguous" });
    expect(pickHit(item, hits, new Set(["2"]))).toMatchObject({ hit: { id: "2" } });
  });

  it("음식점 · 카페가 아니면 빼요", () => {
    expect(pickHit({ name: "서울숲", note: "", url: "" }, [hit("p", "서울숲", 37.5, 127, "AT4")])).toEqual({ reason: "not_food" });
  });

  it("검색어 — 주소가 있으면 시 · 구를 붙임", () => {
    expect(searchQuery({ name: "온도", note: "", url: "", address: "대한민국 서울특별시 성동구 성수동 1" })).toBe("서울특별시 성동구 온도");
    expect(searchQuery({ name: "온도", note: "", url: "" })).toBe("온도");
  });
});
