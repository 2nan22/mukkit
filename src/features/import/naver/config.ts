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
  },
  // 없는 공유 · 비공개 리스트 모두 이 코드로 온다 (둘을 구분할 수 없음)
  notSharedApiErrorCode: 1603,
} as const;
