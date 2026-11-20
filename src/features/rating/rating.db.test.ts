// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, runId, signUpTestUser } from "@/test/localSupabase";
import { countUnrated, getSavedPlace, nextUnrated, updateUserPlace, UserPlaceNotFoundError } from "./rating";
import type { SupabaseClient } from "@supabase/supabase-js";

// 로컬 Supabase 에 실제로 쓴다 — `pnpm test:local-db` 로만 돈다
async function savePlaces(supabase: SupabaseClient, userId: string, names: string[]): Promise<string[]> {
  const rows = names.map((name, i) => ({
    source: "naver",
    source_place_id: `rate-${runId}-${userId.slice(0, 8)}-${i}`,
    name,
    lat: 37.5,
    lng: 127,
    cuisine: "korean",
  }));
  const places = await supabase.from("places").insert(rows).select("id");
  if (places.error) throw places.error;
  const ids = places.data.map((p) => p.id as string);
  const saved = await supabase.from("user_places").insert(
    ids.map((id, i) => ({ user_id: userId, place_id: id, saved_at: new Date(2025, 0, i + 1).toISOString() })),
  );
  if (saved.error) throw saved.error;
  return ids;
}

describe.skipIf(!hasLocalDb)("평가 저장 (로컬 DB)", () => {
  it("등급 · 한마디 · 방문일 · 협찬을 저장하고 다시 읽는다", async () => {
    const { supabase, userId } = await signUpTestUser();
    const [id] = await savePlaces(supabase, userId, ["골목국수"]);

    await updateUserPlace(supabase, userId, id, { tier: "two", note: "비빔이 나음", visitedOn: "2026-10-12", sponsored: true });
    expect(await getSavedPlace(supabase, userId, id)).toMatchObject({
      name: "골목국수",
      tier: "two",
      note: "비빔이 나음",
      visitedOn: "2026-10-12",
      sponsored: true,
    });
  }, 20_000);

  it("평가 전은 최근 저장 순으로 하나씩, 건너뛴 곳은 빼고", async () => {
    const { supabase, userId } = await signUpTestUser();
    const [a, b, c] = await savePlaces(supabase, userId, ["가", "나", "다"]);
    expect(await countUnrated(supabase, userId)).toBe(3);
    expect((await nextUnrated(supabase, userId, []))?.placeId).toBe(c);
    expect((await nextUnrated(supabase, userId, [c]))?.placeId).toBe(b);

    await updateUserPlace(supabase, userId, b, { tier: "wantToGo" });
    expect((await nextUnrated(supabase, userId, [c]))?.placeId).toBe(a);
    expect(await countUnrated(supabase, userId)).toBe(2);
    expect(await nextUnrated(supabase, userId, [a, c])).toBeNull();
  }, 20_000);

  it("남의 저장은 고칠 수 없다", async () => {
    const owner = await signUpTestUser();
    const other = await signUpTestUser();
    const [id] = await savePlaces(owner.supabase, owner.userId, ["남의 가게"]);

    await expect(updateUserPlace(other.supabase, owner.userId, id, { tier: "three" })).rejects.toBeInstanceOf(
      UserPlaceNotFoundError,
    );
    expect((await getSavedPlace(owner.supabase, owner.userId, id))?.tier).toBe("unrated");
  }, 20_000);
});
