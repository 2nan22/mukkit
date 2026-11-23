import { describe, expect, it } from "vitest";
import { extractLink, extractLinks, sourceNameForLink } from "./sources";

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

describe("여러 링크 한 번에", () => {
  it("글 속 링크를 모두 · 같은 링크는 한 번", () => {
    const text = "[네이버지도] 먹킷리스트 https://naver.me/aaa\n[카카오맵] 그룹 https://kko.to/bbb\n다시 https://naver.me/aaa";
    expect(extractLinks(text)).toEqual(["https://naver.me/aaa", "https://kko.to/bbb"]);
  });
  it("링크가 없으면 넣은 글 그대로 · 빈 글은 없음", () => {
    expect(extractLinks(" 0123456789abcdef0123456789abcdef ")).toEqual(["0123456789abcdef0123456789abcdef"]);
    expect(extractLinks("  ")).toEqual([]);
  });
});
