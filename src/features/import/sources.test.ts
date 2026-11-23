import { describe, expect, it } from "vitest";
import { extractLink, sourceNameForLink } from "./sources";

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

describe("공유 문구에서 링크 뽑기", () => {
  it("네이버 · 카카오 앱 공유 문구", () => {
    expect(extractLink("[네이버지도]\n먹킷리스트\nhttps://naver.me/5QsVhoxJ")).toBe("https://naver.me/5QsVhoxJ");
    expect(extractLink("[카카오맵] 먹킷리스트 그룹\n먹어보고 싶은 음식점\n\nhttps://kko.to/c3VcF-bp4B")).toBe("https://kko.to/c3VcF-bp4B");
    expect(sourceNameForLink("[네이버지도]\n먹킷리스트\nhttps://naver.me/5QsVhoxJ")).toBe("naver");
    expect(sourceNameForLink("[카카오맵] 먹킷리스트 그룹\nhttps://kko.to/c3VcF-bp4B")).toBe("kakao");
  });
  it("링크만 있으면 그대로", () => {
    expect(extractLink("  https://naver.me/abc  ")).toBe("https://naver.me/abc");
  });
});
