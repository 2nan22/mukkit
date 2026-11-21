import { describe, expect, it, vi } from "vitest";
import type { ImportedList } from "@/domain/importedPlace";
import type { NaverSharedListSource } from "@/features/import/naver/naverSharedListSource";
import { checkKakaoPlaces, checkNaverLists } from "./checkers";

function respond(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status });
}

describe("checkKakaoPlaces", () => {
  it("200 본문 정상은 영업, 404 는 폐업, 그 밖은 모름", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const id = String(url).split("/").at(-1);
      if (id === "1") return respond(200, { summary: { name: "a" } });
      if (id === "2") return respond(404);
      if (id === "3") return respond(500);
      return respond(200, { unexpected: true });
    });
    const { results, unknown } = await checkKakaoPlaces(["1", "2", "3", "4"], fetchMock as unknown as typeof fetch);
    expect([...results]).toEqual(expect.arrayContaining([["1", true], ["2", false]]));
    expect(results.size).toBe(2);
    expect(unknown).toBe(2);
  });
});

describe("checkNaverLists", () => {
  it("리스트의 available 을 장소별로, 못 읽은 리스트는 건너뜀", async () => {
    const list = { places: [{ sourcePlaceId: "n1", available: true }, { sourcePlaceId: "n2", available: false }] } as unknown as ImportedList;
    const source = {
      fetchList: vi.fn(async (id: string) => {
        if (id === "bad") throw new Error("private");
        return list;
      }),
    } as unknown as NaverSharedListSource;
    const { results, failedLists } = await checkNaverLists(["ok", "bad"], source);
    expect(results.get("n1")).toBe(true);
    expect(results.get("n2")).toBe(false);
    expect(failedLists).toBe(1);
  });
});
