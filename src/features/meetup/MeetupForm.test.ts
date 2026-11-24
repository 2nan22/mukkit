import { describe, expect, it } from "vitest";
import { bandOpen, BANDS, defaultWhen, endFor, timeLabel } from "./MeetupForm";

const LAST = 26 * 60;

describe("endFor", () => {
  it("기본값이면 만나는 시간이 밀려도 2시간 반 뒤로", () => {
    expect(endFor(21 * 60, 21 * 60 + 30, false, LAST)).toBe(23 * 60 + 30);
  });
  it("직접 고른 헤어지는 시간은 그대로", () => {
    expect(endFor(19 * 60, 20 * 60, true, LAST)).toBe(20 * 60);
  });
  it("마지막 시각을 넘지 않는다", () => {
    expect(endFor(25 * 60, 21 * 60 + 30, false, LAST)).toBe(LAST);
  });
});

describe("timeLabel", () => {
  it("자정 넘긴 시각은 새벽으로", () => {
    expect(timeLabel(24 * 60)).toBe("새벽 12:00");
    expect(timeLabel(25 * 60 + 30)).toBe("새벽 1:30");
    expect(timeLabel(23 * 60 + 30)).toBe("오후 11:30");
  });
});

describe("시간대 · 기본값 (67)", () => {
  it("오늘 저녁이 남았으면 오늘 저녁", () => {
    expect(defaultWhen(15 * 60)).toEqual({ day: 0, start: 19 * 60, end: 21 * 60 + 30 });
  });
  it("저녁이 시작했으면 내일 저녁", () => {
    expect(defaultWhen(19 * 60).day).toBe(1);
    expect(defaultWhen(23 * 60).day).toBe(1);
  });
  it("오늘은 시작이 지난 시간대를 못 고름 · 다른 날은 모두", () => {
    expect(bandOpen(0, BANDS[0], 13 * 60)).toBe(false);
    expect(bandOpen(0, BANDS[1], 13 * 60)).toBe(true);
    expect(bandOpen(1, BANDS[0], 23 * 60)).toBe(true);
  });
});
