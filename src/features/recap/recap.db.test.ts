// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, runId, signUpTestUser, testAdminClient } from "@/test/localSupabase";

// 연말 결산 — 함께 간 사람 · 결산 알림 (94) `pnpm test:local-db`
describe.skipIf(!hasLocalDb)("연말 결산 (로컬 DB)", () => {
  async function place(): Promise<string> {
    const { data, error } = await testAdminClient()
      .from("places")
      .insert({ source: "kakao", source_place_id: `recap-${runId}-${Math.random().toString(36).slice(2, 8)}`, name: "결산가게", lat: 37.5, lng: 127, cuisine: "korean" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  it("함께 간 사람 — 수락한 사람 · 내 이름 메모를 세고, 수락 전 · 다른 해 · 차단한 사람은 뺀다", async () => {
    const me = await signUpTestUser();
    const friend = await signUpTestUser();
    const waiting = await signUpTestUser();
    const blocked = await signUpTestUser();
    const admin = testAdminClient();
    const visit = async (on: string, members: { user_id?: string; guest_name?: string; status: string }[]) => {
      const { data } = await admin.from("visits").insert({ place_id: await place(), created_by: me.userId, visited_on: on }).select("id").single();
      await admin.from("visit_members").insert(members.map((m) => ({ visit_id: data!.id, ...m })));
    };
    await visit("2026-03-01", [{ user_id: friend.userId, status: "accepted" }, { guest_name: "엄마", status: "accepted" }, { user_id: waiting.userId, status: "invited" }]);
    await visit("2026-05-01", [{ user_id: friend.userId, status: "accepted" }, { user_id: blocked.userId, status: "accepted" }]);
    await visit("2025-05-01", [{ guest_name: "엄마", status: "accepted" }]);
    await admin.from("blocks").insert({ blocker_id: me.userId, blocked_id: blocked.userId });

    const { data, error } = await me.supabase.rpc("my_recap_companions", { p_year: 2026 });
    expect(error).toBeNull();
    const rows = data as { user_id: string | null; name: string; visits: number }[];
    expect(rows.map((r) => [r.user_id, r.visits])).toEqual([
      [friend.userId, 2],
      [null, 1],
    ]);
    expect(rows[1].name).toBe("엄마");
    // 친구 쪽에서는 나를 만든 사람으로 센다
    const back = (await friend.supabase.rpc("my_recap_companions", { p_year: 2026 })).data as { user_id: string; visits: number }[];
    expect(back.find((r) => r.user_id === me.userId)?.visits).toBe(2);
  }, 30_000);

  it("결산 알림은 남이 대신 만들 수 없고, 결산 철이 아니면 만들지 않는다", async () => {
    const me = await signUpTestUser();
    const { data } = await me.supabase.rpc("claim_recap_notice");
    const month = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", month: "2-digit" }).format(new Date()));
    if (month !== 12 && month !== 1) expect(data).toBe(false);
    // 평가가 없으면 철이어도 없음
    expect((await testAdminClient().from("notifications").select("id").eq("user_id", me.userId).eq("kind", "recap")).data).toEqual([]);
    // 직접 넣기는 막힘
    expect((await me.supabase.from("notifications").insert({ user_id: me.userId, kind: "recap", actor_id: me.userId })).error).not.toBeNull();
  }, 30_000);
});
