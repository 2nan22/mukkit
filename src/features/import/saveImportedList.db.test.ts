// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ImportedList, ImportedPlace } from "@/domain/importedPlace";
import { saveImportedList } from "./saveImportedList";
import { hasLocalDb, runId as run, signUpTestUser as signUp } from "@/test/localSupabase";

// 로컬 Supabase 에 실제로 쓴다 — `pnpm test:local-db` 로만 돈다 (테스트용 사용자를 새로 만든다)

function place(n: number, over: Partial<ImportedPlace> = {}): ImportedPlace {
  return {
    source: "naver",
    sourcePlaceId: `test-${run}-${n}`,
    name: `테스트 가게 ${n}`,
    lat: 37.56,
    lng: 126.99,
    address: "서울 중구",
    categoryPath: ["220036", "220037"],
    categoryName: "국수",
    cuisine: "korean",
    memo: `한마디 ${n}`,
    savedAt: new Date("2025-06-14T03:31:00Z"),
    available: true,
    ...over,
  };
}

function list(id: string, places: ImportedPlace[]): ImportedList {
  return { source: "naver", sourceListId: `${run}-${id}`, name: "을지로 점심", memo: "혼밥", places, expectedCount: places.length, skipped: [] };
}

describe.skipIf(!hasLocalDb)("가져오기 저장 (로컬 DB)", () => {
  it("그냥 저장한 리스트 — 리스트 · 장소 · 메모가 남고, 다시 가져와도 늘지 않는다", async () => {
    const { supabase, userId } = await signUp();
    const naver = list("plain", [place(1), place(2, { available: false }), place(1)]);

    const first = await saveImportedList(supabase, userId, naver, { kind: "plain" });
    expect(first).toMatchObject({ added: 2, alreadySaved: 0, unavailable: 1 });
    expect(first.listId).not.toBeNull();

    const saved = await supabase.from("user_places").select("tier, note, places(category_name, cuisine, available)").eq("user_id", userId).order("note");
    expect(saved.data).toEqual([
      { tier: "unrated", note: "한마디 1", places: { category_name: "국수", cuisine: "korean", available: true } },
      { tier: "unrated", note: "한마디 2", places: { category_name: "국수", cuisine: "korean", available: false } },
    ]);

    await supabase.from("user_places").update({ tier: "two", note: "고친 메모" }).eq("user_id", userId).eq("note", "한마디 1");
    const again = await saveImportedList(supabase, userId, naver, { kind: "plain" });
    expect(again).toMatchObject({ listId: first.listId, added: 0, alreadySaved: 2 });

    const lists = await supabase.from("lists").select("id, visibility").eq("owner_id", userId);
    expect(lists.data).toEqual([{ id: first.listId, visibility: "private" }]);
    const items = await supabase.from("list_items").select("place_id").eq("list_id", first.listId!);
    expect(items.data).toHaveLength(2);
    const kept = await supabase.from("user_places").select("tier, note").eq("user_id", userId).eq("tier", "two");
    expect(kept.data).toEqual([{ tier: "two", note: "고친 메모" }]);
  }, 20_000);

  it("등급 리스트 — 리스트는 만들지 않고, 평가 전인 곳만 그 등급으로", async () => {
    const { supabase, userId } = await signUp();
    await saveImportedList(supabase, userId, list("a", [place(3), place(4)]), { kind: "plain" });
    await supabase.from("user_places").update({ tier: "one" }).eq("user_id", userId).eq("note", "한마디 4");

    const result = await saveImportedList(supabase, userId, list("b", [place(3), place(4), place(5)]), { kind: "tier", tier: "three" });
    expect(result).toMatchObject({ listId: null, added: 1, alreadySaved: 2 });

    const tiers = await supabase.from("user_places").select("note, tier").eq("user_id", userId).order("note");
    expect(tiers.data).toEqual([
      { note: "한마디 3", tier: "three" },
      { note: "한마디 4", tier: "one" },
      { note: "한마디 5", tier: "three" },
    ]);
    const lists = await supabase.from("lists").select("id").eq("owner_id", userId);
    expect(lists.data).toHaveLength(1);
  }, 20_000);

  it("남의 계정으로는 저장할 수 없다", async () => {
    const owner = await signUp();
    const other = await signUp();
    await expect(saveImportedList(other.supabase, owner.userId, list("x", [place(6)]), { kind: "plain" })).rejects.toThrow("user_places");
    const ownerRows = await owner.supabase.from("user_places").select("place_id").eq("user_id", owner.userId);
    expect(ownerRows.data).toEqual([]);
  }, 20_000);
});
