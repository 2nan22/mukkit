import { describe, expect, it } from "vitest";
import { ImportError } from "@/domain/importedPlace";
import { NaverSharedListSource } from "./naverSharedListSource";
import fixture from "./__fixtures__/sharedList.json";

const SHARE_ID = "0123456789abcdef0123456789abcdef";
const FOLDER_URL = `https://map.naver.com/p/favorite/sharedPlace/folder/${SHARE_ID}`;

function fakeFetch(routes: Record<string, () => Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = input.toString();
    const key = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!key) throw new Error(`예상하지 못한 요청: ${url}`);
    return routes[key]();
  }) as typeof fetch;
}

const bookmarksPrefix = `https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/${SHARE_ID}/`;

describe("NaverSharedListSource.resolveShareId", () => {
  it("단축 링크는 리다이렉트 위치에서 shareId 를 꺼낸다", async () => {
    const source = new NaverSharedListSource(
      fakeFetch({
        "https://naver.me/": () =>
          new Response(null, { status: 302, headers: { location: FOLDER_URL } }),
      }),
    );
    await expect(source.resolveShareId("https://naver.me/AbCd")).resolves.toBe(SHARE_ID);
  });

  it("전체 링크와 shareId 자체도 받는다", async () => {
    const source = new NaverSharedListSource(fakeFetch({}));
    await expect(source.resolveShareId(FOLDER_URL)).resolves.toBe(SHARE_ID);
    await expect(source.resolveShareId(SHARE_ID)).resolves.toBe(SHARE_ID);
  });

  it("리스트 링크가 아니면 INVALID_LINK", async () => {
    const source = new NaverSharedListSource(fakeFetch({}));
    await expect(source.resolveShareId("https://map.naver.com/p/entry/place/1")).rejects.toMatchObject({
      code: "INVALID_LINK",
    });
    await expect(source.resolveShareId("아무 글자")).rejects.toMatchObject({ code: "INVALID_LINK" });
  });
});

describe("NaverSharedListSource.fetchList", () => {
  it("한국어 이름을 받도록 언어를 지정해 요청한다", async () => {
    let sent: Headers | undefined;
    const source = new NaverSharedListSource((async (_input: RequestInfo | URL, init?: RequestInit) => {
      sent = new Headers(init?.headers);
      return Response.json(fixture);
    }) as typeof fetch);
    await source.fetchList(SHARE_ID);
    expect(sent?.get("accept-language")).toMatch(/^ko/);
  });

  it("정규형으로 바꾸고 못 읽은 항목은 skipped 로 센다", async () => {
    const source = new NaverSharedListSource(
      fakeFetch({ [bookmarksPrefix]: () => Response.json(fixture) }),
    );
    const list = await source.fetchList(SHARE_ID);

    expect(list.name).toBe("예시 리스트");
    expect(list.expectedCount).toBe(3);
    expect(list.places).toHaveLength(2);
    expect(list.skipped).toHaveLength(1);
    expect(list.skipped[0].index).toBe(2);
    expect(list.places.length + list.skipped.length).toBe(list.expectedCount);

    const [first, second] = list.places;
    expect(first).toMatchObject({
      sourcePlaceId: "1000000001",
      lat: 37.5665,
      lng: 126.9784,
      categoryPath: ["220036", "220037", "220068"],
      memo: "국물이 깔끔함",
    });
    expect(second).toMatchObject({ memo: "", categoryPath: [], available: false });
  });

  it("없거나 비공개인 리스트는 LIST_NOT_FOUND_OR_PRIVATE", async () => {
    const source = new NaverSharedListSource(
      fakeFetch({
        [bookmarksPrefix]: () => Response.json({ statusCode: "400", apiErrorCode: 1603 }, { status: 400 }),
      }),
    );
    const error = await source.fetchList(SHARE_ID).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ImportError);
    expect(error).toMatchObject({ code: "LIST_NOT_FOUND_OR_PRIVATE", detail: { httpStatus: 400 } });
  });

  it("그 밖의 실패는 UPSTREAM_ERROR, 형식이 다르면 UNEXPECTED_RESPONSE", async () => {
    const down = new NaverSharedListSource(
      fakeFetch({ [bookmarksPrefix]: () => new Response("busy", { status: 503 }) }),
    );
    await expect(down.fetchList(SHARE_ID)).rejects.toMatchObject({ code: "UPSTREAM_ERROR" });

    const changed = new NaverSharedListSource(
      fakeFetch({ [bookmarksPrefix]: () => Response.json({ items: [] }) }),
    );
    await expect(changed.fetchList(SHARE_ID)).rejects.toMatchObject({ code: "UNEXPECTED_RESPONSE" });
  });
});
