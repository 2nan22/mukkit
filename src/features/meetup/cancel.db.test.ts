// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, signUpTestUser, testAdminClient } from "@/test/localSupabase";

// 약속 취소 · 나가기 (90) — `pnpm test:local-db`
describe.skipIf(!hasLocalDb)("약속 취소 · 나가기 (로컬 DB)", () => {
  async function setup() {
    const host = await signUpTestUser();
    const member = await signUpTestUser();
    const invited = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const id = m!.id as string;
    const admin = testAdminClient();
    await admin.from("meetup_members").insert({ meetup_id: id, user_id: member.userId });
    await admin.from("meetup_invites").insert({ meetup_id: id, user_id: invited.userId });
    await admin.from("meetup_points").insert({ meetup_id: id, user_id: member.userId, kind: "origin", label: "역", lat: 37.55, lng: 126.99 });
    return { host, member, invited, id, admin };
  }

  it("만든 사람이 취소하면 약속 · 초대 · 알림이 모두 사라지고, 알릴 사람을 돌려준다", async () => {
    const { host, member, invited, id, admin } = await setup();
    // 남은 못 취소
    expect((await member.supabase.rpc("cancel_meetup", { p_meetup: id })).error?.code).toBe("42501");
    expect((await invited.supabase.from("notifications").select("id").eq("meetup_id", id)).data?.length).toBeGreaterThan(0);
    const { data, error } = await host.supabase.rpc("cancel_meetup", { p_meetup: id });
    expect(error).toBeNull();
    expect(new Set(data as string[])).toEqual(new Set([member.userId, invited.userId]));
    expect((await admin.from("meetups").select("id").eq("id", id)).data).toEqual([]);
    expect((await admin.from("meetup_invites").select("user_id").eq("meetup_id", id)).data).toEqual([]);
    expect((await admin.from("meetup_points").select("user_id").eq("meetup_id", id)).data).toEqual([]);
    expect((await admin.from("notifications").select("id").eq("meetup_id", id)).data).toEqual([]);
  }, 30_000);

  it("취소 알림이 알림함에 남는다 — 약속 칸은 비고 약속 시각만 (93)", async () => {
    const { host, member, invited, id, admin } = await setup();
    await admin.from("meetups").update({ starts_at: "2026-12-01T10:00:00Z" }).eq("id", id);
    expect((await host.supabase.rpc("cancel_meetup", { p_meetup: id })).error).toBeNull();
    for (const u of [member, invited]) {
      const { data } = await u.supabase.rpc("my_notifications", { p_limit: 10 });
      const row = (data as { kind: string; actor_id: string; meetup_id: string | null; meetup_starts_at: string }[]).find((r) => r.kind === "meetup_cancel");
      expect(row?.actor_id).toBe(host.userId);
      expect(row?.meetup_id).toBeNull();
      expect(new Date(row!.meetup_starts_at).toISOString()).toBe("2026-12-01T10:00:00.000Z");
    }
    // 취소한 사람에게는 남지 않는다
    expect((await admin.from("notifications").select("id").eq("user_id", host.userId).eq("kind", "meetup_cancel")).data).toEqual([]);
  }, 30_000);

  it("함께하는 사람은 나가기 — 내 참여 · 위치만 지우고, 만든 사람은 나갈 수 없다", async () => {
    const { host, member, id, admin } = await setup();
    expect((await host.supabase.rpc("leave_meetup", { p_meetup: id })).error?.code).toBe("42501");
    expect((await member.supabase.rpc("leave_meetup", { p_meetup: id })).error).toBeNull();
    expect((await admin.from("meetup_members").select("user_id").eq("meetup_id", id)).data?.map((r) => r.user_id)).toEqual([host.userId]);
    expect((await admin.from("meetup_points").select("user_id").eq("meetup_id", id)).data).toEqual([]);
    expect((await admin.from("meetups").select("id").eq("id", id)).data).toHaveLength(1);
  }, 30_000);

  it("끝난 약속은 취소 · 나가기가 안 된다", async () => {
    const { host, member, id, admin } = await setup();
    await admin.from("meetups").update({ status: "done" }).eq("id", id);
    expect((await host.supabase.rpc("cancel_meetup", { p_meetup: id })).error?.code).toBe("P0002");
    expect((await member.supabase.rpc("leave_meetup", { p_meetup: id })).error?.code).toBe("P0002");
  }, 30_000);
});
