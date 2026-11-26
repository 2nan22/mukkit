import { describe, expect, it } from "vitest";
import { parseTransit } from "./transit";

describe("parseTransit", () => {
  it("여러 경로 중 가장 빠른 것(분)", () => {
    expect(parseTransit({ status: "OK", routes: [{ properties: { totalTime: 2115 } }, { properties: { totalTime: 1500 } }] })).toEqual({ status: "ok", minutes: 25 });
  });
  it("경로 없음 계열은 none — 다시 부르지 않음", () => {
    for (const s of ["NO_RESULTS", "STARTNODES_NULL", "ENDNODES_NULL", "EQUAL_POINTS"]) expect(parseTransit({ status: s })).toEqual({ status: "none" });
    expect(parseTransit({ status: "OK", routes: [] })).toEqual({ status: "none" });
  });
  it("모르는 응답은 null — 다음에 다시", () => {
    expect(parseTransit({ status: "INVALID_REQUEST" })).toBeNull();
    expect(parseTransit(null)).toBeNull();
    expect(parseTransit({})).toBeNull();
  });
});
