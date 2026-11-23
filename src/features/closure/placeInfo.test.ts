import { describe, expect, it } from "vitest";
import { diffPlaceInfo, type StoredPlace } from "./placeInfo";

const stored: StoredPlace = {
  id: "p1",
  name: "더딤섬",
  address: "서울 종로구 종로12길 7 지하1층 (관철동)",
  lat: 37.5686,
  lng: 126.9862,
  categoryName: "중식",
  categoryPath: ["음식점", "중식"],
  cuisine: "chinese",
};

describe("diffPlaceInfo", () => {
  it("같으면 바꿀 것이 없다", () => {
    expect(diffPlaceInfo(stored, { ...stored })).toEqual({ patch: {}, far: false });
  });

  it("이름 · 주소 · 업종이 바뀌면 그 칸만", () => {
    const { patch } = diffPlaceInfo(stored, { ...stored, name: "더딤섬 종각점", categoryPath: ["음식점", "중식", "딤섬"], categoryName: "딤섬" });
    expect(patch).toEqual({ name: "더딤섬 종각점", category_path: ["음식점", "중식", "딤섬"], category_name: "딤섬" });
  });

  it("몇 m 흔들림은 무시, 이사는 좌표 · 주소 반영", () => {
    expect(diffPlaceInfo(stored, { ...stored, lat: stored.lat + 0.0001 }).patch).toEqual({});
    const moved = diffPlaceInfo(stored, { ...stored, lat: stored.lat + 0.005, address: "서울 종로구 새 주소 1" }).patch;
    expect(moved).toMatchObject({ address: "서울 종로구 새 주소 1", lat: stored.lat + 0.005 });
  });

  it("너무 멀리 옮겼다고 나오면 반영하지 않는다", () => {
    expect(diffPlaceInfo(stored, { ...stored, name: "다른 가게", lat: stored.lat + 0.1 })).toEqual({ patch: {}, far: true });
  });

  it("빈 값은 덮어쓰지 않는다", () => {
    expect(diffPlaceInfo(stored, { ...stored, name: " ", address: "", categoryPath: [] }).patch).toEqual({});
  });
});
