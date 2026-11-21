// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hasLocalDb, runId, signUpTestUser } from "@/test/localSupabase";
import { addPlaces, createList, deleteList, getMyList, getMyLists, ListNotFoundError, removePlaces, updateList } from "./lists";

// 로컬 Supabase 에 실제로 쓴다 — `pnpm test:local-db` 로만 돈다
async function makePlaces(supabase: SupabaseClient, n: number): Promise<string[]> {
  const rows = Array.from({ length: n }, (_, i) => ({
    source: "naver",
    source_place_id: `list-${runId}-${Math.random().toString(36).slice(2, 8)}-${i}`,
    name: `리스트 가게 ${i}`,
    lat: 37.5,
    lng: 127,
    cuisine: "korean",
  }));
  const { data, error } = await supabase.from("places").insert(rows).select("id");
  if (error) throw error;
  return data.map((r) => r.id as string);
}

describe.skipIf(!hasLocalDb)("내가 만드는 리스트 (로컬 DB)", () => {
  it("만들고 · 장소 넣고 빼고 · 이름 · 공개 범위를 바꾸고 · 지운다", async () => {
    const { supabase, userId } = await signUpTestUser();
    const [a, b, c] = await makePlaces(supabase, 3);

    const id = await createList(supabase, userId, { name: "을지로 점심", description: "" });
    await addPlaces(supabase, userId, id, [a, b, c, a]);
    await removePlaces(supabase, userId, id, [b]);
    await updateList(supabase, userId, id, { name: "을지로 혼밥", visibility: "link" });

    const list = await getMyList(supabase, userId, id);
    expect(list).toMatchObject({ name: "을지로 혼밥", visibility: "link", count: 2, source: null });
    expect(new Set(list?.placeIds)).toEqual(new Set([a, c]));
    expect((await getMyLists(supabase, userId)).map((l) => l.id)).toEqual([id]);

    await deleteList(supabase, userId, id);
    expect(await getMyList(supabase, userId, id)).toBeNull();
  }, 20_000);

  it("남의 리스트는 고치거나 장소를 넣을 수 없다", async () => {
    const owner = await signUpTestUser();
    const other = await signUpTestUser();
    const [a] = await makePlaces(owner.supabase, 1);
    const id = await createList(owner.supabase, owner.userId, { name: "내 리스트", description: "" });

    await expect(addPlaces(other.supabase, other.userId, id, [a])).rejects.toBeInstanceOf(ListNotFoundError);
    await expect(updateList(other.supabase, other.userId, id, { name: "바꿈" })).rejects.toBeInstanceOf(ListNotFoundError);
    await expect(deleteList(other.supabase, other.userId, id)).rejects.toBeInstanceOf(ListNotFoundError);
    expect(await getMyList(owner.supabase, owner.userId, id)).toMatchObject({ name: "내 리스트", count: 0 });
  }, 20_000);
});
