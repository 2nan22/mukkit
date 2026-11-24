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

  it("원본에서 다른 등급 리스트로 옮긴 곳 — 평가 전 · 가고 싶은 곳은 그 등급으로, 빈 메모 · 원본 메모는 새 메모로 (54)", async () => {
    const { supabase, userId } = await signUp();
    const mk = (id: string, name: string, places: ImportedPlace[]): ImportedList => ({ source: "naver", sourceListId: `${id}-${run}`, name, memo: "", places, expectedCount: places.length, skipped: [] });
    // 가고 싶은 곳 리스트에 세 곳 (메모 없음 · 원본 메모 · 직접 매긴 3숟가락)
    const want = mk("mv-want", "먹킷리스트", [place(11, { memo: "" }), place(12, { memo: "원본 메모" }), place(13, { memo: "" })]);
    await saveImportedList(supabase, userId, want, { kind: "tier", tier: "want_to_go" });
    await recordImportSource(supabase, userId, want, { kind: "tier", tier: "want_to_go" });
    const p13 = await supabase.from("imported_items").select("place_id").eq("user_id", userId).eq("source_place_id", `rf-${run}-13`).single();
    await supabase.from("user_places").update({ tier: "three", note: "내가 쓴 메모" }).eq("user_id", userId).eq("place_id", p13.data!.place_id);

    // 네이버에서 2스타 리스트로 옮기고 메모를 남김
    const two = mk("mv-two", "2스타", [place(11, { memo: "또 가도 좋음" }), place(12, { memo: "바뀐 메모" }), place(13, { memo: "원본에서 쓴 메모" })]);
    await recordImportSource(supabase, userId, { ...two, places: [] }, { kind: "tier", tier: "two" });
    const res = await refreshImport(supabase, userId, { source: "naver", sourceListId: two.sourceListId, mode: { kind: "tier", tier: "two" } }, { placeSource: sourceOf(two) });
    expect(res.status).toBe("updated");

    const rows = await supabase.from("imported_items").select("source_place_id, place_id").eq("user_id", userId).eq("source_list_id", two.sourceListId);
    const idOf = new Map(rows.data!.map((r) => [r.source_place_id as string, r.place_id as string]));
    const mine = await supabase.from("user_places").select("place_id, tier, note").eq("user_id", userId);
    const by = new Map(mine.data!.map((r) => [r.place_id as string, r]));
    expect(by.get(idOf.get(`rf-${run}-11`)!)).toMatchObject({ tier: "two", note: "또 가도 좋음" });
    expect(by.get(idOf.get(`rf-${run}-12`)!)).toMatchObject({ tier: "two", note: "바뀐 메모" });
    // 직접 매긴 등급 · 직접 쓴 메모는 그대로
    expect(by.get(idOf.get(`rf-${run}-13`)!)).toMatchObject({ tier: "three", note: "내가 쓴 메모" });
  });

  it("전에 반영이 안 된 채 원본에 그대로 있는 곳도 새로 고치면 등급 · 빈 메모를 맞춤 (54)", async () => {
    const { supabase, userId } = await signUp();
    const two = { source: "naver" as const, sourceListId: `mv-known-${run}`, name: "2스타", memo: "", places: [place(21, { memo: "맛있음" })], expectedCount: 1, skipped: [] };
    await saveImportedList(supabase, userId, two, { kind: "tier", tier: "two" });
    await recordImportSource(supabase, userId, two, { kind: "tier", tier: "two" });
    // 예전 규칙으로 남은 상태 — 가고 싶은 곳 · 빈 메모
    await supabase.from("user_places").update({ tier: "want_to_go", note: "" }).eq("user_id", userId);
    const res = await refreshImport(supabase, userId, { source: "naver", sourceListId: two.sourceListId, mode: { kind: "tier", tier: "two" } }, { placeSource: sourceOf(two) });
    expect(res.status).toBe("unchanged");
    const mine = await supabase.from("user_places").select("tier, note").eq("user_id", userId).single();
    expect(mine.data).toEqual({ tier: "two", note: "맛있음" });
  });

  it("새로 고침으로 새로 들어온 곳도 가져올 때 고른 공개 범위 · updated_at 은 원본 저장 때 (68)", async () => {
    const { supabase, userId } = await signUp();
    const mode = { kind: "tier" as const, tier: "three" as const };
    const three = { source: "naver" as const, sourceListId: `vis-${run}`, name: "3스타", memo: "", places: [place(31)], expectedCount: 1, skipped: [] };
    await saveImportedList(supabase, userId, three, mode, "followers");
    await recordImportSource(supabase, userId, three, mode, "followers");
    await supabase.from("import_sources").update({ last_synced_at: new Date(0).toISOString() }).eq("user_id", userId);
    const more = { ...three, places: [place(31), place(32)], expectedCount: 2 };
    const res = await refreshImport(supabase, userId, { source: "naver", sourceListId: three.sourceListId, mode }, { placeSource: sourceOf(more) });
    expect(res.status).toBe("updated");
    const rows = await supabase.from("user_places").select("visibility, updated_at").eq("user_id", userId);
    expect(rows.data?.map((r) => r.visibility)).toEqual(["followers", "followers"]);
    expect(rows.data?.every((r) => r.updated_at.startsWith("2025-06-14"))).toBe(true);
  });

  it("원본 메모가 바뀌면 옮긴 한 줄 평가도 새 메모로 · 직접 고친 한 줄 평가는 그대로 (68-2)", async () => {
    const { supabase, userId } = await signUp();
    const mode = { kind: "tier" as const, tier: "two" as const };
    const two = { source: "naver" as const, sourceListId: `memo-${run}`, name: "2스타", memo: "", places: [place(41, { memo: "010-1234 사장님 번호" }), place(42, { memo: "옛 메모" })], expectedCount: 2, skipped: [] };
    await saveImportedList(supabase, userId, two, mode, "followers", true);
    await recordImportSource(supabase, userId, two, mode, "followers", true);
    const before = await supabase.from("user_places").select("review").eq("user_id", userId).order("review");
    expect(before.data?.map((r) => r.review)).toEqual(["010-1234 사장님 번호", "옛 메모"]);
    // 42 는 한 줄 평가를 직접 고침
    const ids = await supabase.from("places").select("id, source_place_id").in("source_place_id", [`rf-${run}-41`, `rf-${run}-42`]);
    const idOf = new Map((ids.data ?? []).map((r) => [r.source_place_id as string, r.id as string]));
    await supabase.from("user_places").update({ review: "직접 쓴 평가" }).eq("user_id", userId).eq("place_id", idOf.get(`rf-${run}-42`)!);
    await supabase.from("import_sources").update({ last_synced_at: new Date(0).toISOString() }).eq("user_id", userId);
    const changed = { ...two, places: [place(41, { memo: "맛있음" }), place(42, { memo: "새 메모" })] };
    await refreshImport(supabase, userId, { source: "naver", sourceListId: two.sourceListId, mode }, { placeSource: sourceOf(changed) });
    const after = await supabase.from("user_places").select("place_id, review").eq("user_id", userId);
    const rv = new Map((after.data ?? []).map((r) => [r.place_id as string, r.review]));
    expect(rv.get(idOf.get(`rf-${run}-41`)!)).toBe("맛있음");
    expect(rv.get(idOf.get(`rf-${run}-42`)!)).toBe("직접 쓴 평가");
  });

  it("별명 추가처럼 새 내용은 켜지 않은 한 줄 평가로 공개하지 않음 · 메모는 새로 (68-3)", async () => {
    const { supabase, userId } = await signUp();
    const mode = { kind: "tier" as const, tier: "one" as const };
    const one = { source: "naver" as const, sourceListId: `alias-${run}`, name: "1스타", memo: "", places: [place(51, { memo: "맛있음" })], expectedCount: 1, skipped: [] };
    await saveImportedList(supabase, userId, one, mode, "public", true);
    await recordImportSource(supabase, userId, one, mode, "public", false);
    await supabase.from("import_sources").update({ last_synced_at: new Date(0).toISOString() }).eq("user_id", userId);
    const changed = { ...one, places: [place(51, { memo: "엄마 회사 앞 · 맛있음" })] };
    await refreshImport(supabase, userId, { source: "naver", sourceListId: one.sourceListId, mode }, { placeSource: sourceOf(changed) });
    const row = await supabase.from("user_places").select("note, review").eq("user_id", userId).single();
    expect(row.data).toEqual({ note: "엄마 회사 앞 · 맛있음", review: "맛있음" });
  });
});
