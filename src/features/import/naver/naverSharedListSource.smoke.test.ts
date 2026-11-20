import { describe, expect, it } from "vitest";
import { NaverSharedListSource } from "./naverSharedListSource";
import { summarizeNaverCuisines } from "./naverCuisine";

// 실제 네이버 호출 — NAVER_SHARE_URLS(쉼표 구분)가 있을 때만 수동으로 돈다
const urls = (process.env.NAVER_SHARE_URLS ?? "").split(",").filter(Boolean);

describe.skipIf(urls.length === 0)("네이버 실제 공유 링크 스모크", () => {
  it.each(urls)("%s 장소 수가 리스트 개수와 맞는다", async (url) => {
    const list = await new NaverSharedListSource().fetchList(url);
    expect(list.places.length + list.skipped.length).toBe(list.expectedCount);
    expect(list.skipped).toEqual([]);
  }, 20_000);

  it("전체 리스트 기준 음식점 미매핑이 5% 미만이다", async () => {
    const source = new NaverSharedListSource();
    const lists = await Promise.all(urls.map((url) => source.fetchList(url)));
    const summary = summarizeNaverCuisines(lists.flatMap((l) => l.places.map((p) => p.categoryPath)));
    const ratio = summary.unmappedCount / summary.foodCount;
    expect(ratio, `미매핑 ${summary.unmappedCount}/${summary.foodCount} ${summary.unmappedCodes.join(" ")}`).toBeLessThan(0.05);
  }, 30_000);
});
