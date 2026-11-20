// 카카오맵 비공식 내부 API — 바뀌면 여기만 고친다 (근거: CLAUDE.md 결정 기록)
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const KAKAO_FOLDER = {
  folderInfoUrl: (folderId: string) => `https://map.kakao.com/folder/info?folderId=${folderId}`,
  favoritesUrl: (folderId: string) => `https://map.kakao.com/favorite/list?folderid=${folderId}`,
  placeUrl: (placeId: string) => `https://place-api.map.kakao.com/places/panel3/${placeId}`,
  mapHost: "map.kakao.com",
  shortLinkHosts: ["kko.to", "kko.kakao.com"],
  // 공개 폴더 상태 값 — 그 밖은 비공개로 본다
  openStatus: "O",
  headers: {
    "User-Agent": USER_AGENT,
    Referer: "https://map.kakao.com/",
    "Accept-Language": "ko-KR,ko;q=0.9",
  },
  placeHeaders: {
    "User-Agent": USER_AGENT,
    Referer: "https://place.map.kakao.com/",
    "Accept-Language": "ko-KR,ko;q=0.9",
    pf: "web",
  },
  // 장소 상세를 동시에 몇 개까지 부를지
  placeConcurrency: 6,
} as const;
