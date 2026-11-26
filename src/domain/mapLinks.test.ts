import { describe, expect, it } from "vitest";
import { googleSearchLink, kakaoPlaceLink, kakaoRouteLink, kakaoSearchLink, naverPlaceLink, naverSearchLink, platformOf } from "./mapLinks";

describe("지도 앱 주소", () => {
  it("카카오 장소 — 안드로이드 intent 에 앱이 없을 때 웹 주소", () => {
    const l = kakaoPlaceLink("12345");
    expect(l.web).toBe("https://place.map.kakao.com/12345");
    expect(l.ios).toBe("kakaomap://place?id=12345");
    expect(l.android).toBe(
      "intent://place?id=12345#Intent;scheme=kakaomap;package=net.daum.android.map;S.browser_fallback_url=https%3A%2F%2Fplace.map.kakao.com%2F12345;end",
    );
  });

  it("카카오 길찾기 — 도착 좌표, 웹은 이름 포함", () => {
    const l = kakaoRouteLink("을지로 국밥", 37.56, 126.99);
    expect(l.ios).toBe("kakaomap://route?ep=37.56,126.99&by=PUBLICTRANSIT");
    expect(l.web).toBe(`https://map.kakao.com/link/to/${encodeURIComponent("을지로 국밥")},37.56,126.99`);
  });

  it("이름 검색은 인코딩", () => {
    expect(kakaoSearchLink("a&b 국밥").ios).toBe(`kakaomap://search?q=${encodeURIComponent("a&b 국밥")}`);
    expect(naverSearchLink("국밥").web).toBe(`https://map.naver.com/p/search/${encodeURIComponent("국밥")}`);
  });

  it("네이버 장소 — 앱은 좌표 · 이름 · appname, 웹은 장소 ID", () => {
    const l = naverPlaceLink("999", "국밥", 37.5, 127.1);
    expect(l.web).toBe("https://map.naver.com/p/entry/place/999");
    expect(l.ios).toMatch(new RegExp(`^nmap://place\\?lat=37.5&lng=127.1&name=${encodeURIComponent("국밥")}&appname=https%3A%2F%2F`));
    expect(l.android).toContain("package=com.nhn.android.nmap");
  });

  it("구글은 웹 주소 하나", () => {
    const l = googleSearchLink("을지로 국밥", "서울 중구 을지로 1");
    expect(l).toEqual({ web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("을지로 국밥 서울 중구 을지로 1")}` });
  });

  it("기기 구분", () => {
    expect(platformOf("Mozilla/5.0 (Linux; Android 14; SM-S711N)")).toBe("android");
    expect(platformOf("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("other");
  });
});
