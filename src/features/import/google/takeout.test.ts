import { describe, expect, it } from "vitest";
import { coordsFromUrl, parseCsv, readSavedCsv, readSavedPlacesJson, readTakeoutFiles } from "./takeout";

const CSV = `﻿성수 맛집 모음

Title,Note,URL,Tags,Comment
소문난 국밥,"줄 서도 먹을 만함, 수육 추천",https://www.google.com/maps/place/%EC%86%8C%EB%AC%B8/data=!4m2!3m1!1s0x357ca4:0x12ab,,
"카페 ""온도""",,"https://www.google.com/maps/search/37.5446,127.0559",,두 번째 방문
,,,,
`;

describe("구글 테이크아웃 CSV", () => {
  it("설명 줄 · BOM · 따옴표 · 빈 줄을 견딘다", () => {
    const items = readSavedCsv(CSV)!;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ name: "소문난 국밥", note: "줄 서도 먹을 만함, 수육 추천" });
    expect(items[0].lat).toBeUndefined();
    expect(items[1]).toMatchObject({ name: '카페 "온도"', note: "두 번째 방문", lat: 37.5446, lng: 127.0559 });
  });

  it("머리줄이 없는 CSV 는 구글 저장 파일이 아님", () => {
    expect(readSavedCsv("a,b\n1,2")).toBeNull();
  });

  it("줄바꿈 낀 칸", () => {
    expect(parseCsv('a,"x\ny",c\r\n1,2,3')).toEqual([["a", "x\ny", "c"], ["1", "2", "3"]]);
  });
});

describe("Saved Places.json", () => {
  it("지금 형식 — 좌표는 [경도, 위도], 0,0 은 모름", () => {
    const json = JSON.stringify({
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: { type: "Point", coordinates: [127.0559, 37.5446] }, properties: { google_maps_url: "http://maps.google.com/?cid=1", location: { name: "온도", address: "서울 성동구" }, Comment: "좋음" } },
        { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { google_maps_url: "u2", location: { name: "좌표 없음" } } },
      ],
    });
    const items = readSavedPlacesJson(json)!;
    expect(items[0]).toEqual({ name: "온도", note: "좋음", url: "http://maps.google.com/?cid=1", lat: 37.5446, lng: 127.0559, address: "서울 성동구" });
    expect(items[1].lat).toBeUndefined();
  });

  it("옛 형식 — Title · Location", () => {
    const json = JSON.stringify({ type: "FeatureCollection", features: [{ geometry: { coordinates: [127, 37.5] }, properties: { Title: "옛가게", "Google Maps URL": "u", Location: { "Business Name": "옛가게", Address: "주소" } } }] });
    expect(readSavedPlacesJson(json)![0]).toMatchObject({ name: "옛가게", address: "주소", lat: 37.5, lng: 127 });
  });
});

describe("파일 묶음", () => {
  it("리스트 이름은 파일 이름 · 가고 싶은 장소 알아봄 · 리뷰 파일은 뺌", () => {
    const lists = readTakeoutFiles([
      { name: "Takeout/Saved/Want to go.csv", text: "Title,Note,URL\nA,,u1\n" },
      { name: "테이크아웃/저장됨/가고 싶은 장소.csv", text: "Title,Note,URL\nB,,u2\n" },
      { name: "Takeout/Saved/성수.csv", text: "Title,Note,URL\nC,,u3\nC,,u3\n" },
      { name: "Takeout/Maps (your places)/Reviews.json", text: '{"type":"FeatureCollection","features":[{"properties":{"location":{"name":"R"}}}]}' },
      { name: "Takeout/archive_browser.html", text: "<html>" },
    ]);
    expect(lists.map((l) => [l.name, l.wantToGo, l.items.length])).toEqual([
      ["가고 싶은 곳", true, 1],
      ["가고 싶은 장소", true, 1],
      ["성수", false, 1],
    ]);
  });

  it("주소 속 좌표 모양", () => {
    expect(coordsFromUrl("https://www.google.com/maps/@37.1,127.2,15z")).toEqual({ lat: 37.1, lng: 127.2 });
    expect(coordsFromUrl("https://www.google.com/maps/place/x/data=!3d37.3!4d127.4")).toEqual({ lat: 37.3, lng: 127.4 });
    expect(coordsFromUrl("https://www.google.com/maps/place/x")).toEqual({});
  });
});
