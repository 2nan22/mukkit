import { describe, expect, it } from "vitest";
import { checkKakaoPlaces } from "./checkers";

// 실제 카카오 호출 — CLOSURE_SMOKE_KAKAO_IDS(쉼표 구분)가 있을 때만 수동으로 돈다
const ids = (process.env.CLOSURE_SMOKE_KAKAO_IDS ?? "").split(",").filter(Boolean);

describe.skipIf(ids.length === 0)("카카오 폐업 확인 스모크", () => {
  it("영업 중인 장소는 영업으로, 응답 형식이 맞아 모름이 적다", async () => {
    const { results, unknown } = await checkKakaoPlaces(ids);
    console.info("[smoke] open", [...results.values()].filter(Boolean).length, "closed", [...results.values()].filter((v) => !v).length, "unknown", unknown);
    expect(unknown).toBeLessThanOrEqual(Math.ceil(ids.length * 0.1));
  }, 60_000);
});
