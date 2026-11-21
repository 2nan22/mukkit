import { afterEach, describe, expect, it, vi } from "vitest";
import { hitToImportedPlace, searchKakaoKeyword } from "./kakaoLocal";
import { cleanQuery } from "./search";

const DOC = {
  id: "12345",
  place_name: "삼대할먼네",
  category_name: "음식점 > 분식 > 떡볶이",
  address_name: "서울 중구 신당동 1",
  road_address_name: "서울 중구 퇴계로76길 54",
  x: "127.0151",
  y: "37.5650",
  distance: "420",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("searchKakaoKeyword", () => {
  it("키가 없으면 null — 검색할 수 없음과 결과 없음을 구분", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    expect(await searchKakaoKeyword("떡볶이")).toBeNull();
  });

  it("카카오 응답을 장소 · 음식 종류 · 거리로 옮긴다", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ documents: [DOC] })));
    vi.stubGlobal("fetch", fetchMock);
    const [hit] = (await searchKakaoKeyword("삼대", { lat: 37.56, lng: 127.01, radius: 20000 }))!;
    expect(hit).toMatchObject({ id: "12345", name: "삼대할먼네", lat: 37.565, lng: 127.0151, cuisine: "snack", categoryName: "떡볶이", distance: 420 });
    expect(hit.address).toBe("서울 중구 퇴계로76길 54");
    expect(String(fetchMock.mock.calls[0][0])).toContain("radius=20000");
  });

  it("응답이 깨지면 빈 결과", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not json")));
    expect(await searchKakaoKeyword("x")).toEqual([]);
  });
});

describe("hitToImportedPlace", () => {
  it("카카오 출처 장소로 — 가져오기와 같은 경로로 합치기 · 만들기", () => {
    const p = hitToImportedPlace({ id: "1", name: "a", lat: 1, lng: 2, address: "", categoryPath: ["음식점", "한식"], categoryName: "한식", cuisine: "korean", distance: null });
    expect(p).toMatchObject({ source: "kakao", sourcePlaceId: "1", cuisine: "korean", memo: "" });
  });
});

describe("cleanQuery", () => {
  it("검색식을 깨는 문자 제거 · 길이 제한", () => {
    expect(cleanQuery(" 떡%볶_이(,) ")).toBe("떡볶이");
    expect(cleanQuery("가".repeat(60))).toHaveLength(40);
  });
});
