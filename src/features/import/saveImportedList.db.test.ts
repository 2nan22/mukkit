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
    raw: { n },
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
    await expect(saveImportedList(other.supabase, owner.userId, list("x", [place(6)]), { kind: "plain" })).rejects.toThrow("가져오기 저장 실패");
    const ownerRows = await owner.supabase.from("user_places").select("place_id").eq("user_id", owner.userId);
    expect(ownerRows.data).toEqual([]);
  }, 20_000);

  it("네이버 · 카카오의 같은 가게는 장소 하나, 출처별 메모 · 리스트 이름은 원본으로 남는다", async () => {
    const { supabase, userId } = await signUp();
    const lat = 37.5 + Math.random() / 100;
    const naver = place(7, { name: `엉터리해장국${run} 서여의도점`, lat, lng: 126.92, memo: "네이버 메모" });
    const kakao = place(7, { source: "kakao", name: `엉터리 해장국${run}(서여의도점)`, lat: lat + 0.0001, lng: 126.92, memo: "카카오 메모" });
    const far = place(8, { source: "kakao", name: `엉터리해장국${run} 서여의도점`, lat: lat + 0.01, lng: 126.92 });

    await saveImportedList(supabase, userId, { ...list("n", [naver]), name: "난슐랭 2star" }, { kind: "tier", tier: "two" });
    const second = await saveImportedList(supabase, userId, { ...list("k", [kakao, far]), source: "kakao", name: "먹킷리스트" }, { kind: "tier", tier: "want_to_go" });
    expect(second).toMatchObject({ added: 1, alreadySaved: 1 });

    const saved = await supabase.from("user_places").select("tier, note").eq("user_id", userId);
    expect(saved.data).toHaveLength(2);
    expect(saved.data).toContainEqual({ tier: "two", note: "네이버 메모" });

    const items = await supabase.from("imported_items").select("source, list_name, memo, place_id").eq("user_id", userId).order("source");
    expect(items.data?.map(({ source, list_name, memo }) => [source, list_name, memo])).toEqual([
      ["kakao", "먹킷리스트", "카카오 메모"],
      ["kakao", "먹킷리스트", "한마디 8"],
      ["naver", "난슐랭 2star", "네이버 메모"],
    ]);
    const naverItem = items.data!.find((i) => i.memo === "네이버 메모")!;
    const kakaoItem = items.data!.find((i) => i.memo === "카카오 메모")!;
    expect(kakaoItem.place_id).toBe(naverItem.place_id);
  }, 20_000);

  it("등급 리스트는 가져올 때 고른 공개 범위로 — 새로 넣은 곳 · 평가 전이던 곳 모두, 가고 싶은 곳은 그대로 (68)", async () => {
    const { supabase, userId } = await signUp();
    await saveImportedList(supabase, userId, list("vp", [place(20)]), { kind: "plain" });
    await saveImportedList(supabase, userId, list("vt", [place(20), place(21)]), { kind: "tier", tier: "three" }, "followers");
    await saveImportedList(supabase, userId, list("vw", [place(22)]), { kind: "tier", tier: "want_to_go" }, "public");
    const rows = await supabase.from("user_places").select("tier, visibility, places(source_place_id)").eq("user_id", userId);
    const by = new Map((rows.data ?? []).map((r) => [(r.places as unknown as { source_place_id: string }).source_place_id, [r.tier, r.visibility]]));
    expect(by.get(`test-${run}-20`)).toEqual(["three", "followers"]);
    expect(by.get(`test-${run}-21`)).toEqual(["three", "followers"]);
    expect(by.get(`test-${run}-22`)).toEqual(["want_to_go", "private"]);
    // 등급 리스트의 메모는 한 줄 평가로도 (68-2) · 가고 싶은 곳은 아님
    const reviews = await supabase.from("user_places").select("review, places(source_place_id)").eq("user_id", userId);
    const rv = new Map((reviews.data ?? []).map((r) => [(r.places as unknown as { source_place_id: string }).source_place_id, r.review]));
    expect(rv.get(`test-${run}-20`)).toBe("한마디 20");
    expect(rv.get(`test-${run}-21`)).toBe("한마디 21");
    expect(rv.get(`test-${run}-22`)).toBe("");
  }, 20_000);
});
