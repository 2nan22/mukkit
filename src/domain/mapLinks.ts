// 외부 지도 앱 주소 (72) — 폰에선 앱이 있으면 앱, 없으면 web. 컴퓨터는 web 그대로
// 안드로이드는 intent:// (앱이 없으면 브라우저가 browser_fallback_url 로), 아이폰은 앱 주소 뒤 안 열리면 web (MapAppLink)
export type MapLink = { web: string; android?: string; ios?: string };

const KAKAO_PACKAGE = "net.daum.android.map";
const NAVER_PACKAGE = "com.nhn.android.nmap";
// 네이버 지도 앱 주소는 부른 쪽 이름(appname)이 필요 — 웹 주소를 쓴다
const NAVER_APPNAME = "https://mukkit-app.vercel.app";

function intent(path: string, scheme: string, pkg: string, web: string): string {
  return `intent://${path}#Intent;scheme=${scheme};package=${pkg};S.browser_fallback_url=${encodeURIComponent(web)};end`;
}

function app(scheme: string, path: string, pkg: string, web: string): MapLink {
  return { web, android: intent(path, scheme, pkg, web), ios: `${scheme}://${path}` };
}

export function kakaoPlaceLink(id: string): MapLink {
  return app("kakaomap", `place?id=${encodeURIComponent(id)}`, KAKAO_PACKAGE, `https://place.map.kakao.com/${encodeURIComponent(id)}`);
}

export function kakaoSearchLink(query: string): MapLink {
  const q = encodeURIComponent(query);
  return app("kakaomap", `search?q=${q}`, KAKAO_PACKAGE, `https://map.kakao.com/?q=${q}`);
}

// 도착지만 — 출발지는 앱이 현재 위치로 · 수단은 대중교통(앱에서 바꿀 수 있음)
export function kakaoRouteLink(name: string, lat: number, lng: number): MapLink {
  return app("kakaomap", `route?ep=${lat},${lng}&by=PUBLICTRANSIT`, KAKAO_PACKAGE, `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`);
}

// 앱 장소 주소는 좌표 · 이름(네이버 지도 URL Scheme 안내), 웹은 장소 ID 페이지
export function naverPlaceLink(id: string, name: string, lat: number, lng: number): MapLink {
  const path = `place?lat=${lat}&lng=${lng}&name=${encodeURIComponent(name)}&appname=${encodeURIComponent(NAVER_APPNAME)}`;
  return app("nmap", path, NAVER_PACKAGE, `https://map.naver.com/p/entry/place/${encodeURIComponent(id)}`);
}

export function naverSearchLink(query: string): MapLink {
  const q = encodeURIComponent(query);
  return app("nmap", `search?query=${q}&appname=${encodeURIComponent(NAVER_APPNAME)}`, NAVER_PACKAGE, `https://map.naver.com/p/search/${q}`);
}

// 구글은 Google Maps URLs — 폰에선 구글 지도 앱이 이 주소를 직접 받는다 (앱 주소 따로 없음)
export function googleSearchLink(name: string, address: string): MapLink {
  return { web: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${address}`.trim())}` };
}

export type Platform = "android" | "ios" | "other";

export function platformOf(userAgent: string): Platform {
  if (/Android/i.test(userAgent)) return "android";
  // 아이패드 데스크톱 모드는 Macintosh + 터치로 온다
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  return "other";
}
