// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, runId, signUpTestUser, testAdminClient } from "@/test/localSupabase";

// 기본 공개 범위 (87) — `pnpm test:local-db`
describe.skipIf(!hasLocalDb)("기본 공개 범위 (로컬 DB)", () => {
  it("새로 저장하는 곳은 기본값으로, 직접 넣은 값은 그대로, 기본값은 본인만", async () => {
    const me = await signUpTestUser();
    const other = await signUpTestUser();
    const { data: places, error } = await testAdminClient()
      .from("places")
      .insert([0, 1, 2].map((i) => ({ source: "naver", source_place_id: `defvis-${runId}-${me.userId.slice(0, 8)}-${i}`, name: `기본${i}`, lat: 37.5, lng: 127, cuisine: "korean" })))
      .select("id");
    if (error) throw error;
    const [a, b, c] = places.map((p) => p.id as string);
    const visOf = async (id: string) => (await me.supabase.from("user_places").select("visibility").eq("user_id", me.userId).eq("place_id", id).single()).data?.visibility;

    // 아직 안 정함 — 나만
    expect((await me.supabase.rpc("my_default_visibility")).data).toBeNull();
    await me.supabase.from("user_places").insert({ user_id: me.userId, place_id: a });
    expect(await visOf(a)).toBe("private");

    expect((await me.supabase.rpc("set_default_visibility", { p_vis: "followers" })).error).toBeNull();
    expect((await me.supabase.rpc("my_default_visibility")).data).toBe("followers");
    // 가져오기처럼 여러 줄 · 공개 범위 없이
    await me.supabase.from("user_places").upsert([{ user_id: me.userId, place_id: b, tier: "unrated" }], { onConflict: "user_id,place_id", ignoreDuplicates: true });
    expect(await visOf(b)).toBe("followers");
    await me.supabase.from("user_places").insert({ user_id: me.userId, place_id: c, visibility: "private" });
    expect(await visOf(c)).toBe("private");
    // 이미 있던 곳은 그대로
    expect(await visOf(a)).toBe("private");

    // 남의 기본값은 못 읽고 못 바꿈 — 칸도 공개 읽기에서 빠짐
    expect((await other.supabase.rpc("my_default_visibility")).data).toBeNull();
    expect((await other.supabase.from("profiles").select("default_visibility").eq("id", me.userId)).error).not.toBeNull();
  }, 30_000);
});
