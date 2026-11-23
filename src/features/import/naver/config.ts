// 네이버 지도 비공식 내부 API — 바뀌면 여기만 고친다 (근거: ADR 0001 · CLAUDE.md 결정 기록)
export const NAVER_SHARED_LIST = {
  bookmarksUrl: (shareId: string) =>
    `https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/${shareId}/bookmarks?start=0&limit=${NAVER_SHARED_LIST.pageLimit}&sort=lastUseTime`,
  // 네이버 리스트 1개 최대 저장 수와 같게 둔다 — 넘으면 expectedCount 불일치로 드러난다
  pageLimit: 5000,
  shortLinkHost: "naver.me",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    Referer: "https://map.naver.com/",
    // 빠지면 Node fetch 가 "*" 를 보내 네이버가 가게 이름을 영어로 준다
    "Accept-Language": "ko-KR,ko;q=0.9",
  },
  // 없는 공유 · 비공개 리스트 모두 이 코드로 온다 (둘을 구분할 수 없음)
  notSharedApiErrorCode: 1603,
} as const;

// 네이버 장소 메뉴 — 카카오맵에 메뉴가 없을 때만 쓰는 차선책 (47). 모바일 장소 페이지 안의 데이터에서 메뉴만 꺼낸다 (사진은 쓰지 않음)
export const NAVER_PLACE = {
  menuUrl: (placeId: string) => `https://m.place.naver.com/place/${placeId}/menu/list`,
  // 화면의 원문 링크 — 네이버 지도 앱 · 웹이 여는 주소
  pageUrl: (placeId: string) => `https://map.naver.com/p/entry/place/${placeId}`,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Accept-Language": "ko-KR,ko;q=0.9",
  },
} as const;
