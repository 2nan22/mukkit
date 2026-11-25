import { describe, expect, it } from "vitest";
import { dividerIndex, nothingNew, parseTime } from "./feedSeen";

const at = (...d: string[]) => d.map((updatedAt) => ({ updatedAt }));

describe("dividerIndex", () => {
  it("기준이 없으면 구분선 없음", () => expect(dividerIndex(at("2026-11-25T10:00:00Z"), null)).toBe(-1));
  it("기준보다 오래된 첫 카드 앞", () => expect(dividerIndex(at("2026-11-25T10:00:00Z", "2026-11-24T10:00:00Z", "2026-11-23T10:00:00Z"), "2026-11-24T12:00:00Z")).toBe(1));
  it("새 평가가 없으면 맨 앞", () => expect(dividerIndex(at("2026-11-20T10:00:00Z"), "2026-11-24T12:00:00Z")).toBe(0));
  it("모두 새 평가면 이 쪽에는 없음", () => expect(dividerIndex(at("2026-11-25T10:00:00Z"), "2026-11-24T12:00:00Z")).toBe(-1));
  it("마이크로초 문자열도 비교", () => expect(dividerIndex(at("2026-11-24T12:00:00.123456+00:00"), "2026-11-24T12:00:00.5+00:00")).toBe(0));
});

describe("parseTime · nothingNew", () => {
  it("Postgres 시각 모양도 읽음", () => expect(parseTime("2026-11-24 12:00:00.123456+00")).toBe(Date.parse("2026-11-24T12:00:00.123Z")));
  it("위가 모두 내 평가면 새 평가 없음", () => {
    expect(nothingNew([{ ownerId: "me" }, { ownerId: "a" }], 1, "me")).toBe(true);
    expect(nothingNew([{ ownerId: "a" }, { ownerId: "me" }], 1, "me")).toBe(false);
  });
});
