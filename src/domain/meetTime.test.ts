import { describe, expect, it } from "vitest";
import { meetShort, meetWhen, timeRange } from "./meetTime";

// 2026-11-24 23:00 KST
const NOW = Date.UTC(2026, 10, 24, 14, 0);

describe("약속 시간 표기 (67)", () => {
  it("같은 때면 끝은 시각만", () => {
    expect(timeRange(19 * 60, 21 * 60 + 30)).toBe("저녁 7:00 ~ 9:30");
    expect(timeRange(20 * 60, 23 * 60)).toBe("저녁 8:00 ~ 밤 11:00");
  });
  it("내일 · 요일 · 자정 넘김", () => {
    expect(meetWhen("2026-11-25T10:00:00.000Z", "2026-11-25T12:30:00.000Z", NOW)).toBe("내일 25일(수) 저녁 7:00 ~ 9:30");
    expect(meetWhen("2026-11-25T14:00:00.000Z", "2026-11-25T16:00:00.000Z", NOW)).toBe("내일 25일(수) 밤 11:00 ~ 새벽 1:00");
    expect(meetWhen("2026-11-28T03:00:00.000Z", null, NOW)).toBe("11월 28일(토) 점심 12:00");
  });
});

describe("meetShort", () => {
  const now = new Date("2026-11-28T03:00:00Z").getTime(); // 한국 28일 낮
  it("사흘 안은 오늘 · 내일 · 모레", () => {
    expect(meetShort("2026-11-29T10:00:00Z", now)).toEqual({ day: "내일", part: "저녁", clock: "7:00" });
    expect(meetShort("2026-11-28T03:30:00Z", now)).toEqual({ day: "오늘", part: "점심", clock: "12:30" });
  });
  it("그 밖은 날짜 · 시간 미정은 null", () => {
    expect(meetShort("2026-12-03T10:00:00Z", now)?.day).toBe("12월 3일(목)");
    expect(meetShort(null, now)).toBeNull();
  });
});
