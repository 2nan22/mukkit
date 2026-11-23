// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ImportError, type ImportedList, type ImportedPlace, type PlaceSource } from "@/domain/importedPlace";
import { recordImportSource, refreshImport } from "./refreshImport";
import { saveImportedList } from "./saveImportedList";
import { hasLocalDb, runId as run, signUpTestUser as signUp } from "@/test/localSupabase";

// 로컬 Supabase 에 실제로 쓴다 — `pnpm test:local-db` 로만 돈다

function place(n: number, over: Partial<ImportedPlace> = {}): ImportedPlace {
  return {
    source: "naver",
    sourcePlaceId: `rf-${run}-${n}`,
    name: `새로고침 가게 ${n}`,
    lat: 37.56,
    lng: 126.99,
    address: "서울 중구",
    categoryPath: ["220036"],
    categoryName: "국수",
    cuisine: "korean",
    memo: `메모 ${n}`,
    savedAt: new Date("2025-06-14T03:31:00Z"),
    available: true,
    raw: { n },
    ...over,
  };
}
const list = (places: ImportedPlace[], name = "을지로"): ImportedList => ({ source: "naver", sourceListId: `rf-${run}`, name, memo: "", places, expectedCount: places.length, skipped: [] });
const sourceOf = (l: ImportedList | Error): PlaceSource => ({
  fetchList: async () => {
    if (l instanceof Error) throw l;
    return l;
  },
});

describe.skipIf(!hasLocalDb)("가져온 리스트 새로 고침 (로컬 DB)", () => {
  it("빠진 곳은 리스트에서만 · 새 곳 추가 · 고치지 않은 메모만 바꿈 · 같으면 그대로 · 비공개면 표시", async () => {
    const { supabase, userId } = await signUp();
    const first = list([place(1), place(2), place(3)]);
    const saved = await saveImportedList(supabase, userId, first, { kind: "plain" });
    await recordImportSource(supabase, userId, first, { kind: "plain" });
    // 내가 2번 메모를 고침
    await supabase.from("user_places").update({ note: "내가 고친 메모" }).eq("user_id", userId).eq("note", "메모 2");

    const next = list([place(2, { memo: "원본 메모 바뀜 2" }), place(3, { memo: "원본 메모 바뀜 3" }), place(4)], "을지로 점심");
    const key = { source: "naver" as const, sourceListId: first.sourceListId, mode: { kind: "plain" as const } };
    const res = await refreshImport(supabase, userId, key, { placeSource: sourceOf(next) });
    expect(res).toEqual({ status: "updated", added: 1, removed: 1, memos: 1 });

    const notes = await supabase.from("user_places").select("note").eq("user_id", userId).order("note");
    expect(notes.data?.map((r) => r.note)).toEqual(["내가 고친 메모", "메모 1", "메모 4", "원본 메모 바뀜 3"]);
    const items = await supabase.from("list_items").select("place_id").eq("list_id", saved.listId!);
    expect(items.data).toHaveLength(3);
    const l = await supabase.from("lists").select("name").eq("id", saved.listId!).single();
    expect(l.data?.name).toBe("을지로 점심");

    expect(await refreshImport(supabase, userId, key, { placeSource: sourceOf(next) })).toEqual({ status: "unchanged" });

    // 내가 리스트에서 뺀 곳은 다시 넣지 않음
    const p4 = await supabase.from("imported_items").select("place_id").eq("user_id", userId).eq("source_place_id", `rf-${run}-4`).single();
    await supabase.from("list_items").delete().eq("list_id", saved.listId!).eq("place_id", p4.data!.place_id);
    const withMemo = list([place(2, { memo: "원본 메모 바뀜 2" }), place(3, { memo: "또 바뀜 3" }), place(4)], "을지로 점심");
    expect(await refreshImport(supabase, userId, key, { placeSource: sourceOf(withMemo) })).toEqual({ status: "updated", added: 0, removed: 0, memos: 1 });
    expect((await supabase.from("list_items").select("place_id").eq("list_id", saved.listId!)).data).toHaveLength(2);

    // 원본이 일부만 오거나 절반 넘게 빠지면 반영하지 않음
    const partial = { ...withMemo, places: [place(2)], expectedCount: 3 };
    expect(await refreshImport(supabase, userId, key, { placeSource: sourceOf(partial) })).toEqual({ status: "error" });
    const tooMany = list([place(2)], "을지로 점심");
    expect(await refreshImport(supabase, userId, key, { placeSource: sourceOf(tooMany) })).toEqual({ status: "error" });

    const gone = await refreshImport(supabase, userId, key, { placeSource: sourceOf(new ImportError("LIST_NOT_FOUND_OR_PRIVATE", "비공개")) });
    expect(gone).toEqual({ status: "unavailable" });
    const src = await supabase.from("import_sources").select("status, fail_count").eq("user_id", userId).single();
    expect(src.data).toEqual({ status: "unavailable", fail_count: 3 });

    // 먹킷 리스트를 지우면 새로 고침을 멈춤
    await supabase.from("lists").delete().eq("id", saved.listId!);
    expect(await refreshImport(supabase, userId, key, { placeSource: sourceOf(next) })).toEqual({ status: "dropped" });
    expect((await supabase.from("import_sources").select("user_id").eq("user_id", userId)).data).toHaveLength(0);
  }, 30_000);
});
