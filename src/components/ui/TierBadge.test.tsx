import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierBadge } from "./TierBadge";
import { isRated, TIERS } from "@/domain/tier";

describe("TierBadge", () => {
  it("등급마다 라벨과 등급 색 클래스가 붙는다", () => {
    render(<TierBadge tier="three" />);
    const badge = screen.getByText("3숟가락");
    expect(badge.dataset.tier).toBe("three");
    expect(badge.className).toContain("bg-tier-3");
  });
});

describe("isRated", () => {
  it("평가 전 · 가고 싶은 곳은 신뢰 통계에서 빠진다", () => {
    const rated = TIERS.filter(isRated);
    expect(rated).toEqual(["three", "two", "one", "notRecommended"]);
  });
});
