import { describe, expect, it } from "vitest";
import { guessMode, modeFromValue, modeLabel, modeToValue } from "./importMode";

describe("guessMode", () => {
  it("이름에 등급이 보이면 그 등급, 아니면 리스트로", () => {
    expect(guessMode("3스타")).toEqual({ kind: "tier", tier: "three" });
    expect(guessMode("난슐랭 2 스타")).toEqual({ kind: "tier", tier: "two" });
    expect(guessMode("가보고 싶은 곳")).toEqual({ kind: "tier", tier: "want_to_go" });
    expect(guessMode("비추")).toEqual({ kind: "tier", tier: "not_recommended" });
    expect(guessMode("을지로 점심")).toEqual({ kind: "plain" });
  });
});

describe("mode 직렬화", () => {
  it("select 값으로 오가도 같다", () => {
    expect(modeFromValue(modeToValue({ kind: "tier", tier: "one" }))).toEqual({ kind: "tier", tier: "one" });
    expect(modeFromValue("plain")).toEqual({ kind: "plain" });
    expect(modeFromValue("unrated")).toEqual({ kind: "plain" });
    expect(modeLabel({ kind: "plain" })).toBe("리스트로 · 평가 전");
  });
});
