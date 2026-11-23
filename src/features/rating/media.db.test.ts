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
});
