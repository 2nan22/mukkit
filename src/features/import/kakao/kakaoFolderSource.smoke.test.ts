import { describe, expect, it } from "vitest";
import { KakaoFolderSource } from "./kakaoFolderSource";
import { kakaoCuisineOf } from "./kakaoCuisine";

// 실제 카카오 호출 — KAKAO_SHARE_URLS(쉼표 구분)가 있을 때만 수동으로 돈다
const urls = (process.env.KAKAO_SHARE_URLS ?? "").split(",").filter(Boolean);

describe.skipIf(urls.length === 0)("카카오 실제 공유 링크 스모크", () => {
  it.each(urls)("%s 장소 수가 폴더 개수와 맞는다", async (url) => {
    const list = await new KakaoFolderSource().fetchList(url);
    expect(list.places.length + list.skipped.length).toBe(list.expectedCount);
    expect(list.skipped).toEqual([]);
  }, 30_000);

  it("음식점 미매핑이 5% 미만이다", async () => {
    const source = new KakaoFolderSource();
    const lists = await Promise.all(urls.map((url) => source.fetchList(url)));
    const food = lists.flatMap((l) => l.places).filter((p) => p.categoryPath[0] === "음식점");
    const unmapped = food.filter((p) => kakaoCuisineOf(p.categoryPath).unmapped);
    expect(unmapped.length / Math.max(food.length, 1), unmapped.map((p) => p.categoryPath.join(">")).join(" ")).toBeLessThan(0.05);
  }, 30_000);
});
