// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, signUpTestUser } from "@/test/localSupabase";

// 약속 이름 (96) — `pnpm test:local-db`
describe.skipIf(!hasLocalDb)("약속 이름 (로컬 DB)", () => {
  it("참여자만 바꾸고, 상태 · 링크 초대 함수가 이름을 돌려준다", async () => {
    const host = await signUpTestUser();
    const other = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal", title: "팀 회식" }).select("id, invite_token").single();
    const id = m!.id as string;

    // 참여자가 아니면 0행 — 이름 그대로
    const { data: none } = await other.supabase.from("meetups").update({ title: "남이 바꿈" }).eq("id", id).select("id");
    expect(none ?? []).toHaveLength(0);
    // 링크로 연 사람(비참여자)도 이름을 본다
    const { data: inv } = await other.supabase.rpc("meetup_invite", { p_token: m!.invite_token });
    expect(inv?.[0]?.title).toBe("팀 회식");

    expect((await host.supabase.from("meetups").update({ title: "금요일 저녁" }).eq("id", id).select("id")).data).toHaveLength(1);
    const { data: st } = await host.supabase.rpc("meetup_status", { p_meetup: id });
    expect(st?.[0]?.title).toBe("금요일 저녁");
    // 공백뿐이거나 30자 넘는 이름은 DB 가 거절
    expect((await host.supabase.from("meetups").update({ title: "   " }).eq("id", id)).error).not.toBeNull();
    expect((await host.supabase.from("meetups").update({ title: "가".repeat(31) }).eq("id", id)).error).not.toBeNull();
  }, 30_000);
});
