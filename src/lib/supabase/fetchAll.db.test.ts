// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { countMyTiers } from "@/features/lists/lists";
import { getMyMapPlaces } from "@/features/map/myPlaces";
import { hasLocalDb, runId, signUpTestUser, testAdminClient } from "@/test/localSupabase";

// 행 수 제한(max_rows 1000)을 넘는 사용자 — 숫자 · 지도가 1000에서 잘리지 않는지 (55) · `pnpm test:local-db`
describe.skipIf(!hasLocalDb)("1000곳 넘게 저장한 사용자", () => {
  const placeIds: string[] = [];
  afterAll(async () => {
    const admin = testAdminClient();
    for (let i = 0; i < placeIds.length; i += 500) await admin.from("places").delete().in("id", placeIds.slice(i, i + 500));
  });

  it("등급별 숫자 · 내 지도 장소를 끝까지 센다", async () => {
    const { supabase, userId } = await signUpTestUser();
    const admin = testAdminClient();
    const N = 1105;
    const rows = Array.from({ length: N }, (_, i) => ({ source: "naver", source_place_id: `many-${runId}-${i}`, name: `많이 ${i}`, lat: 37.5, lng: 127, cuisine: "korean" }));
    for (let i = 0; i < N; i += 500) {
      const { data, error } = await admin.from("places").insert(rows.slice(i, i + 500)).select("id");
      expect(error).toBeNull();
      placeIds.push(...data!.map((r) => r.id as string));
    }
    for (let i = 0; i < N; i += 500) {
      const part = placeIds.slice(i, i + 500).map((id, j) => ({ user_id: userId, place_id: id, tier: i + j < 5 ? "three" : "want_to_go" }));
      const { error } = await supabase.from("user_places").insert(part);
      expect(error).toBeNull();
    }
    expect(await countMyTiers(supabase, userId)).toEqual({ three: 5, want_to_go: N - 5 });
    expect(await getMyMapPlaces(supabase, userId)).toHaveLength(N);
  }, 60_000);
});
