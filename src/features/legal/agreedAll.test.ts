import { describe, expect, it } from "vitest";
import { agreedAll } from "./legal";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("agreedAll", () => {
  it("모든 항목을 체크하면 통과", () => {
    expect(agreedAll(form({ agree_items: "age,terms,privacy", agree_age: "on", agree_terms: "on", agree_privacy: "on" }), ["age", "terms", "privacy"])).toBe(true);
  });
  it("하나라도 빠지면 실패", () => {
    expect(agreedAll(form({ agree_items: "age,terms,privacy", agree_age: "on", agree_terms: "on" }), ["age", "terms", "privacy"])).toBe(false);
  });
  it("필수 항목을 목록에서 빼도 실패", () => {
    expect(agreedAll(form({ agree_items: "terms", agree_terms: "on" }), ["age", "terms", "privacy"])).toBe(false);
  });
  it("개정 동의는 이용약관만", () => {
    expect(agreedAll(form({ agree_items: "terms", agree_terms: "on" }))).toBe(true);
  });
  it("목록이 없거나 모르는 항목이면 실패", () => {
    expect(agreedAll(form({}))).toBe(false);
    expect(agreedAll(form({ agree_items: "terms,x", agree_terms: "on", agree_x: "on" }))).toBe(false);
  });
});
