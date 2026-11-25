import { describe, expect, it } from "vitest";
import { dateLabel } from "./RatingCard";

describe("dateLabel", () => {
  const now = new Date("2026-11-25T03:00:00Z");
  it("올해는 월 · 일만", () => expect(dateLabel("2026-03-04T03:00:00Z", now)).toBe("3월 4일"));
  it("지난해 이전은 연도까지", () => expect(dateLabel("2019-12-12T03:00:00Z", now)).toBe("2019년 12월 12일"));
  it("한국 시간 기준 날짜", () => expect(dateLabel("2025-12-31T16:00:00Z", now)).toBe("1월 1일"));
});
