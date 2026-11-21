import { describe, expect, it } from "vitest";
import { sourceNameForLink } from "./sources";

describe("sourceNameForLink", () => {
  it("링크로 네이버 · 카카오를 고른다", () => {
    expect(sourceNameForLink("https://naver.me/AbCd")).toBe("naver");
    expect(sourceNameForLink("https://map.naver.com/p/favorite/sharedPlace/folder/0123456789abcdef0123456789abcdef")).toBe("naver");
    expect(sourceNameForLink("0123456789abcdef0123456789abcdef")).toBe("naver");
    expect(sourceNameForLink("https://map.kakao.com/?folderid=1000001")).toBe("kakao");
    expect(sourceNameForLink(" https://kko.to/AbCd ")).toBe("kakao");
    expect(sourceNameForLink("1000001")).toBe("kakao");
  });

  it("모르는 링크는 null", () => {
    expect(sourceNameForLink("https://maps.google.com/x")).toBeNull();
    expect(sourceNameForLink("아무 글자")).toBeNull();
  });
});
