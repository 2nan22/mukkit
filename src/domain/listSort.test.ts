import { describe, expect, it } from "vitest";
import { distanceLabel, sortListPlaces } from "./listSort";

const P = (name: string, tier: "three" | "two" | "one" | "wantToGo" | "unrated" | null, lat: number) => ({ name, tier, lat, lng: 127 });
const items = [P("다람", "two", 37.3), P("가람", "unrated", 37.1), P("나루", "three", 37.5), P("마루", "two", 37.2), P("바다", null, 37.0)];

describe("sortListPlaces", () => {
  it("담은 순은 그대로", () => {
    expect(sortListPlaces(items, "added").map((p) => p.name)).toEqual(["다람", "가람", "나루", "마루", "바다"]);
  });
  it("등급 순은 높은 등급 위 · 같은 등급은 담은 순 · 등급 없는 곳은 맨 아래", () => {
    expect(sortListPlaces(items, "tier").map((p) => p.name)).toEqual(["나루", "다람", "마루", "가람", "바다"]);
  });
  it("이름 순은 가나다", () => {
    expect(sortListPlaces(items, "name").map((p) => p.name)).toEqual(["가람", "나루", "다람", "마루", "바다"]);
  });
  it("가까운 순은 내 위치 기준 · 위치가 없으면 담은 순", () => {
    expect(sortListPlaces(items, "near", { me: { lat: 37.21, lng: 127 } }).map((p) => p.name)).toEqual(["마루", "다람", "가람", "바다", "나루"]);
    expect(sortListPlaces(items, "near").map((p) => p.name)).toEqual(["다람", "가람", "나루", "마루", "바다"]);
  });
  it("등급 거르기는 고른 등급만 남긴다", () => {
    expect(sortListPlaces(items, "added", { tiers: ["two"] }).map((p) => p.name)).toEqual(["다람", "마루"]);
  });
});

describe("distanceLabel", () => {
  it("1km 안은 m, 밖은 km", () => {
    expect(distanceLabel(234)).toBe("230m");
    expect(distanceLabel(3)).toBe("10m");
    expect(distanceLabel(1530)).toBe("1.5km");
  });
});
