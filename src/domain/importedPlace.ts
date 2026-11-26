import type { Cuisine } from "./cuisine";

export type PlaceSourceName = "naver" | "kakao";

// 출처와 무관한 가져오기 결과 정규형
export type ImportedPlace = {
  source: PlaceSourceName;
  sourcePlaceId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  categoryPath: string[];
  categoryName: string;
  // 출처가 자기 분류로 정한 음식 종류 — 저장은 출처를 모른다
  cuisine: Cuisine;
  memo: string;
  // 지도 앱에서 장소에 붙인 별명 (네이버, 68-7) — 메모와 따로. 가게 이름과 같으면 빈 값
  alias?: string;
  savedAt: Date;
  available: boolean;
  // 출처가 준 항목 그대로 — 나중에 분류 · 리스트 만들 때 쓰는 원천 데이터
  raw: unknown;
  // 원본 앱이 장소 출처와 다를 때(구글 테이크아웃 → 카카오 가게) — 원본 메모를 견줄 때 이 앱으로 (76)
  origin?: "google";
};

export type ImportedList = {
  source: PlaceSourceName;
  sourceListId: string;
  name: string;
  memo: string;
  places: ImportedPlace[];
  // 출처가 말한 개수 — places 와 다르면 skipped 로 설명돼야 한다
  expectedCount: number;
  // 원본 이름이 장소 출처와 다를 때 — 구글 테이크아웃은 가게를 카카오로 맞추지만 원본 기록 · 리스트는 'google' (76)
  origin?: "google";
  skipped: { index: number; reason: string }[];
};

export interface PlaceSource {
  // knownIds: 이미 가져온 장소 — 새로 고칠 때 상세 조회를 건너뛴다(카카오)
  fetchList(input: string, opts?: { knownIds?: ReadonlySet<string> }): Promise<ImportedList>;
}

export type ImportErrorCode =
  | "INVALID_LINK"
  | "LIST_NOT_FOUND_OR_PRIVATE"
  | "UPSTREAM_ERROR"
  | "UNEXPECTED_RESPONSE";

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
    readonly detail?: { httpStatus?: number; upstreamCode?: number | string },
  ) {
    super(message);
    this.name = "ImportError";
  }
}
