import { describe, expect, it } from "vitest";
import { countInView } from "./countInView";

const view = { south: 37.5, west: 127.0, north: 37.6, east: 127.1 };

describe("countInView", () => {
  it("보이는 범위 안만 센다 · 등급별", () => {
    const points = [
      { lat: 37.55, lng: 127.05, tier: "three" as const },
      { lat: 37.55, lng: 127.05, tier: "wantToGo" as const },
      { lat: 37.55, lng: 127.05, tier: "unrated" as const },
      { lat: 37.7, lng: 127.05, tier: "three" as const },
      { lat: 37.55, lng: 126.9, tier: "wantToGo" as const },
    ];
    expect(countInView(points, view)).toEqual({ saved: 3, three: 1, want: 1 });
  });
  it("경계 위 점은 포함", () => {
    expect(countInView([{ lat: 37.5, lng: 127.1, tier: "two" }], view)).toEqual({ saved: 1, three: 0, want: 0 });
  });
});
