import { describe, expect, it } from "vitest";
import { endFor, timeLabel } from "./MeetupForm";

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
