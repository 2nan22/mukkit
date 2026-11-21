import { describe, expect, it } from "vitest";
import { isSamePlace, normalizePlaceName } from "./samePlace";

const base = { name: "엉터리해장국 서여의도점", lat: 37.5262, lng: 126.9215 };

describe("isSamePlace", () => {
  it("가깝고 이름이 같거나 한쪽이 지점명을 더 붙였으면 같은 가게", () => {
    expect(isSamePlace(base, { ...base, name: "엉터리 해장국(서여의도점)", lat: 37.5264 })).toBe(true);
    expect(isSamePlace(base, { ...base, name: "엉터리해장국" })).toBe(true);
  });

  it("50m 넘게 떨어지거나 이름이 다르면 다른 가게", () => {
    expect(isSamePlace(base, { ...base, lat: 37.5268 })).toBe(false);
    expect(isSamePlace(base, { ...base, name: "옆집 국밥" })).toBe(false);
  });

  it("한 글자 이름은 완전히 같을 때만", () => {
    expect(isSamePlace({ ...base, name: "담" }, { ...base, name: "담소" })).toBe(false);
  });
});

describe("normalizePlaceName", () => {
  it("공백 · 괄호 · 대소문자를 지운다", () => {
    expect(normalizePlaceName("Cafe Onion (성수)")).toBe("cafeonion성수");
  });
});
