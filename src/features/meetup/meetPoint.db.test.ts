// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, signUpTestUser, testAdminClient } from "@/test/localSupabase";

// 만날 곳 · 대중교통 구간 (86) — `pnpm test:local-db`
describe.skipIf(!hasLocalDb)("만날 곳 · 대중교통 (로컬 DB)", () => {
  it("만날 곳은 참여자만 · 진행 중만 · 실제 지역 이름만", async () => {
    const host = await signUpTestUser();
    const other = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const id = m!.id as string;
    const set = (sb: typeof host.supabase, area: string | null, label = "을지로입구역") =>
      sb.rpc("set_meet_point", { p_meetup: id, p_label: label, p_lat: 37.566, p_lng: 126.982, p_area: area });

    expect((await set(host.supabase, "을지로")).error).toBeNull();
    expect((await host.supabase.from("meetups").select("meet_label, meet_area").eq("id", id).single()).data).toEqual({ meet_label: "을지로입구역", meet_area: "을지로" });
    expect((await set(host.supabase, "없는 동네")).error?.code).toBe("22023");
    expect((await set(other.supabase, null)).error?.code).toBe("42501");
    // 칸을 직접 고치지 못함(함수로만)
    await host.supabase.from("meetups").update({ meet_label: "아무 글" }).eq("id", id);
    expect((await host.supabase.from("meetups").select("meet_label").eq("id", id).single()).data?.meet_label).toBe("을지로입구역");

    expect((await host.supabase.from("meetups").update({ status: "cancelled" }).eq("id", id)).error).not.toBeNull();
    expect((await host.supabase.rpc("finish_meetup", { p_meetup: id })).error).toBeNull();
    expect((await set(host.supabase, "을지로", "다른 곳")).error?.code).toBe("P0002");
  }, 30_000);

  it("안 잰 구간은 고른 지역에서만, 1.5km 안은 빼고, 이미 잰 칸은 빼고", async () => {
    const host = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const id = m!.id as string;
    const admin = testAdminClient();
    // 성수 근처 출발 — 을지로(먼 곳)와 성수(1.5km 안)
    await admin.from("meetup_points").insert({ meetup_id: id, user_id: host.userId, kind: "origin", label: "성수역", lat: 37.5446, lng: 127.0559 });
    // 이 칸이 이미 재져 있으면(다른 시험 · 화면) 비우고 시작
    await admin.from("transit_legs").delete().eq("from_cell", "37.54,127.06").eq("to_cell", "37.566,126.992");
    const needs = async (areas: string[]) => ((await admin.rpc("meetup_transit_needs", { p_meetup: id, p_areas: areas })).data ?? []) as { to_cell: string }[];
    const far = await needs(["을지로", "성수"]);
    expect(far).toHaveLength(1);
    expect(far[0].to_cell).toBe("37.566,126.992");
    // 사용자는 부를 수 없음
    expect((await host.supabase.rpc("meetup_transit_needs", { p_meetup: id, p_areas: ["을지로"] })).error).not.toBeNull();
    await admin.from("transit_legs").upsert({ from_cell: "37.54,127.06", to_cell: "37.566,126.992", status: "ok", minutes: 25 });
    expect(await needs(["을지로"])).toHaveLength(0);
    await admin.from("transit_legs").delete().eq("from_cell", "37.54,127.06").eq("to_cell", "37.566,126.992");
  }, 30_000);
});
