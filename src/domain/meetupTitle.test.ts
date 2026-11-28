import { describe, expect, it } from "vitest";
import { cleanMeetupTitle } from "./meetup";

describe("cleanMeetupTitle", () => {
  it("공백을 하나로 · 비면 null", () => {
    expect(cleanMeetupTitle("  금요일   팀 회식 ")).toBe("금요일 팀 회식");
    expect(cleanMeetupTitle("   ")).toBeNull();
    expect(cleanMeetupTitle("​​")).toBeNull();
    expect(cleanMeetupTitle(null)).toBeNull();
  });
  it("30글자로 자르되 이모지를 반쪽 내지 않는다 · 묶음 이모지는 그대로", () => {
    expect(Array.from(cleanMeetupTitle("가".repeat(29) + "🍜🍜")!)).toHaveLength(30);
    expect(cleanMeetupTitle("👨‍👩‍👧 모임")).toBe("👨‍👩‍👧 모임");
  });
});
