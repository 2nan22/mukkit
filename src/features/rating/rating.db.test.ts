// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, runId, signUpTestUser, testAdminClient } from "@/test/localSupabase";
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
  const places = await testAdminClient().from("places").insert(rows).select("id");
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

  it("등급을 바꿀 때만 평가한 날이 바뀌고, 글 · 메뉴만 고치면 그대로 (82)", async () => {
    const { supabase, userId } = await signUpTestUser();
    const [id] = await savePlaces(supabase, userId, ["바다초밥"]);
    const ratedAt = async () => (await supabase.from("user_places").select("rated_at").eq("place_id", id).single()).data!.rated_at as string;

    await updateUserPlace(supabase, userId, id, { tier: "two" });
    const first = await ratedAt();
    await new Promise((r) => setTimeout(r, 20));
    await updateUserPlace(supabase, userId, id, { review: "국물이 진해요", menus: ["우동"] });
    expect(await ratedAt()).toBe(first);
    // 직접 바꾸려 해도 그대로
    await supabase.from("user_places").update({ rated_at: "2030-01-01T00:00:00Z" }).eq("place_id", id);
    expect(await ratedAt()).toBe(first);

    await updateUserPlace(supabase, userId, id, { tier: "three" });
    expect(Date.parse(await ratedAt())).toBeGreaterThan(Date.parse(first));
  }, 20_000);

  it("평가 전은 최근 저장 순으로 하나씩, 건너뛴 곳은 빼고", async () => {
    const { supabase, userId } = await signUpTestUser();
    const [a, b, c] = await savePlaces(supabase, userId, ["가", "나", "다"]);
    expect(await countUnrated(supabase, userId)).toBe(3);
    const first = await nextUnrated(supabase, userId, null);
    expect(first?.placeId).toBe(c);
    // c 를 건너뛰면 c 자리 다음부터
    expect((await nextUnrated(supabase, userId, first!.cursor))?.placeId).toBe(b);

    await updateUserPlace(supabase, userId, b, { tier: "wantToGo" });
    const afterC = await nextUnrated(supabase, userId, first!.cursor);
    expect(afterC?.placeId).toBe(a);
    expect(await countUnrated(supabase, userId)).toBe(2);
    expect(await nextUnrated(supabase, userId, afterC!.cursor)).toBeNull();
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
