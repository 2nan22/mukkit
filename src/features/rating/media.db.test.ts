// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, runId, signUpTestUser, testAdminClient } from "@/test/localSupabase";

// 로컬 Supabase Storage 에 실제로 올린다 — `pnpm test:local-db` 로만 돈다
const BUCKET = "rating-media";
const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" });

describe.skipIf(!hasLocalDb)("평가 사진 저장소 정책 (로컬)", () => {
  it("내 폴더에만 올리고, 남은 나만 공개 사진을 못 받고, 공개로 바꾸면 받는다", async () => {
    const owner = await signUpTestUser();
    const other = await signUpTestUser();
    const place = await testAdminClient()
      .from("places")
      .insert({ source: "naver", source_place_id: `media-${runId}-${Date.now()}`, name: "사진 가게", lat: 37.5, lng: 127, cuisine: "korean" })
      .select("id")
      .single();
    const placeId = place.data!.id as string;
    await owner.supabase.from("user_places").insert({ user_id: owner.userId, place_id: placeId, tier: "three" });

    const path = `${owner.userId}/${placeId}/a.jpg`;
    expect((await owner.supabase.storage.from(BUCKET).upload(path, jpeg)).error).toBeNull();
    expect((await other.supabase.storage.from(BUCKET).upload(`${owner.userId}/${placeId}/b.jpg`, jpeg)).error).not.toBeNull();

    expect((await other.supabase.storage.from(BUCKET).createSignedUrl(path, 60)).error).not.toBeNull();
    await owner.supabase.from("user_places").update({ visibility: "public" }).eq("user_id", owner.userId).eq("place_id", placeId);
    expect((await other.supabase.storage.from(BUCKET).createSignedUrl(path, 60)).error).toBeNull();

    expect((await other.supabase.storage.from(BUCKET).remove([path])).data).toEqual([]);
    expect((await owner.supabase.storage.from(BUCKET).remove([path])).data).toHaveLength(1);
  }, 30_000);

  it("사진 순서 바꾸기 — 내 평가 사진 전부를 고른 순서로, 빠지거나 남의 것이면 거절 (77)", async () => {
    const owner = await signUpTestUser();
    const other = await signUpTestUser();
    const place = await testAdminClient()
      .from("places")
      .insert({ source: "naver", source_place_id: `order-${runId}-${Date.now()}`, name: "순서 가게", lat: 37.5, lng: 127, cuisine: "korean" })
      .select("id")
      .single();
    const placeId = place.data!.id as string;
    await owner.supabase.from("user_places").insert({ user_id: owner.userId, place_id: placeId, tier: "three" });
    const rows = await owner.supabase
      .from("rating_media")
      .insert(["a", "b", "c"].map((n) => ({ user_id: owner.userId, place_id: placeId, path: `${owner.userId}/${placeId}/${runId}-${n}.jpg`, kind: "image" })))
      .select("id, path");
    const id = (n: string) => rows.data!.find((r) => (r.path as string).endsWith(`-${n}.jpg`))!.id as string;
    const order = async () =>
      (await owner.supabase.from("rating_media").select("path").eq("place_id", placeId).order("created_at")).data!.map((r) => (r.path as string).slice(-5, -4));

    const latestBefore = (await owner.supabase.from("rating_media").select("created_at").eq("place_id", placeId).order("created_at", { ascending: false }).limit(1)).data![0].created_at;
    expect((await owner.supabase.rpc("reorder_my_media", { p_place: placeId, p_ids: [id("c"), id("a"), id("b")] })).error).toBeNull();
    expect(await order()).toEqual(["c", "a", "b"]);
    // 시각 묶음은 그대로(가장 최근 시각 유지) · 장소 대표 사진은 첫 사진
    const latestAfter = (await owner.supabase.from("rating_media").select("created_at").eq("place_id", placeId).order("created_at", { ascending: false }).limit(1)).data![0].created_at;
    // 같은 시각에 함께 올린 사진이라 순서를 세우려 몇 마이크로초만 늘어난다
    expect(new Date(latestAfter as string).getTime() - new Date(latestBefore as string).getTime()).toBeLessThan(1);
    const cover = await owner.supabase.rpc("place_covers", { p_places: [placeId] });
    expect((cover.data as { path: string }[])[0].path.slice(-5, -4)).toBe("c");
    // 겹친 목록도 거절
    expect((await owner.supabase.rpc("reorder_my_media", { p_place: placeId, p_ids: [id("a"), id("a"), id("b")] })).error).not.toBeNull();
    // 하나 빠짐 · 남이 부름 — 거절, 순서 그대로
    expect((await owner.supabase.rpc("reorder_my_media", { p_place: placeId, p_ids: [id("a"), id("b")] })).error).not.toBeNull();
    expect((await other.supabase.rpc("reorder_my_media", { p_place: placeId, p_ids: [id("a"), id("b"), id("c")] })).error).not.toBeNull();
    expect(await order()).toEqual(["c", "a", "b"]);
  }, 30_000);
});
