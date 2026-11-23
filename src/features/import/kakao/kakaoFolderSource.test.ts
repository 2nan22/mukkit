import { describe, expect, it } from "vitest";
import { KakaoFolderSource } from "./kakaoFolderSource";
import fixture from "./__fixtures__/folder.json";

function fakeFetch(routes: Record<string, () => Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = input.toString();
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!key) throw new Error(`예상하지 못한 요청: ${url}`);
    return routes[key]();
  }) as typeof fetch;
}

const PLACE = "https://place-api.map.kakao.com/places/panel3/";
const routes = (info: unknown = fixture.info) => ({
  "https://map.kakao.com/folder/info": () => Response.json(info),
  "https://map.kakao.com/favorite/list": () => Response.json(fixture.favorites),
  [`${PLACE}111`]: () => Response.json(fixture.places["111"]),
  [PLACE]: () => Response.json({ panel_card_tags: [] }),
});

describe("KakaoFolderSource.resolveFolderId", () => {
  it("폴더 링크 · 숫자 · 단축 링크를 받는다", async () => {
    const source = new KakaoFolderSource(
      fakeFetch({
        "https://kko.to/": () =>
          new Response(null, { status: 302, headers: { location: "https://map.kakao.com/?folderid=1000001&target=other" } }),
      }),
    );
    await expect(source.resolveFolderId("https://map.kakao.com/?folderid=1000001&page=bookmark")).resolves.toBe("1000001");
    await expect(source.resolveFolderId("1000001")).resolves.toBe("1000001");
    // 2026-11 앱 공유 — 앱 열기 주소 안에 folderid
    await expect(source.resolveFolderId("https://map.kakao.com/?kakaomapScheme=open%3Fpage%3Dbookmark%26folderid%3D19348571")).resolves.toBe("19348571");
    await expect(source.resolveFolderId("https://kko.to/AbCd")).resolves.toBe("1000001");
  });

  it("폴더 링크가 아니면 INVALID_LINK", async () => {
    const source = new KakaoFolderSource(fakeFetch({}));
    await expect(source.resolveFolderId("https://map.kakao.com/?itemId=1")).rejects.toMatchObject({ code: "INVALID_LINK" });
    await expect(source.resolveFolderId("아무 글자")).rejects.toMatchObject({ code: "INVALID_LINK" });
  });
});

describe("KakaoFolderSource.fetchList", () => {
  it("장소는 상세의 위경도 · 업종으로, 상세가 없거나 주소면 즐겨찾기 좌표로", async () => {
    const list = await new KakaoFolderSource(fakeFetch(routes())).fetchList("1000001");

    expect(list).toMatchObject({ source: "kakao", sourceListId: "1000001", name: "예시 폴더", memo: "예시 설명", expectedCount: 4 });
    expect(list.places).toHaveLength(3);
    expect(list.skipped).toEqual([{ index: 3, reason: expect.any(String) }]);

    const [place, closed, address] = list.places;
    expect(place).toMatchObject({
      sourcePlaceId: "111",
      name: "예시 국밥",
      lat: 37.5446,
      lng: 127.0532,
      categoryPath: ["음식점", "한식", "국밥"],
      categoryName: "국밥",
      cuisine: "korean",
      memo: "예시 메모",
      available: true,
    });
    expect(place.savedAt.toISOString()).toBe("2025-02-26T09:42:27.000Z");
    expect(closed).toMatchObject({ available: false, cuisine: "nonFood", memo: "" });
    expect(closed.lat).toBeCloseTo(37.5426, 3);
    expect(address).toMatchObject({ sourcePlaceId: "N123", available: true, cuisine: "nonFood" });
  });

  it("없거나 비공개 폴더는 LIST_NOT_FOUND_OR_PRIVATE", async () => {
    const notFound = { status: { code: "NOT_EXIST_ITEM" } };
    const closed = { ...fixture.info, folders: [{ ...fixture.info.folders[0], status: "C" }] };
    await expect(new KakaoFolderSource(fakeFetch(routes(notFound))).fetchList("1")).rejects.toMatchObject({
      code: "LIST_NOT_FOUND_OR_PRIVATE",
    });
    await expect(new KakaoFolderSource(fakeFetch(routes(closed))).fetchList("1")).rejects.toMatchObject({
      code: "LIST_NOT_FOUND_OR_PRIVATE",
    });
  });
});
