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
  savedAt: Date;
  available: boolean;
};

export type ImportedList = {
  source: PlaceSourceName;
  sourceListId: string;
  name: string;
  memo: string;
  places: ImportedPlace[];
  // 출처가 말한 개수 — places 와 다르면 skipped 로 설명돼야 한다
  expectedCount: number;
  skipped: { index: number; reason: string }[];
};

export interface PlaceSource {
  fetchList(input: string): Promise<ImportedList>;
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
