// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasLocalDb, runId, signUpTestUser, testAdminClient } from "@/test/localSupabase";
import { getCourse } from "./course";

// 약속 코스 — 참여자만 · 5곳 · 통째로 바꾸기 · 길은 서버만 (`pnpm test:local-db`)
async function makePlaces(n: number): Promise<string[]> {
  const rows = Array.from({ length: n }, (_, i) => ({
    source: "kakao",
    source_place_id: `course-${runId}-${Math.random().toString(36).slice(2, 8)}-${i}`,
    name: `코스가게${i}`,
    lat: 37.56 + i * 0.002,
    lng: 126.99,
    cuisine: "korean",
  }));
  const { data, error } = await testAdminClient().from("places").insert(rows).select("id");
  if (error) throw error;
  return data.map((p) => p.id as string);
}

describe.skipIf(!hasLocalDb)("약속 코스 (로컬 DB)", () => {
  it("참여자가 담고 순서를 바꾸면 그대로 읽히고, 남은 못 고친다", async () => {
    const host = await signUpTestUser();
    const other = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const meetupId = m!.id as string;
    const [a, b, c] = await makePlaces(3);

    expect((await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [a, b, c] })).error).toBeNull();
    let course = await getCourse(host.supabase, meetupId);
    expect(course.stops.map((s) => s.placeId)).toEqual([a, b, c]);
    // 길을 아직 안 받았으면 직선 어림
    expect(course.route?.estimated).toBe(true);
    expect(course.route?.legs).toHaveLength(2);

    await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [c, a] });
    course = await getCourse(host.supabase, meetupId);
    expect(course.stops.map((s) => s.placeId)).toEqual([c, a]);

    // 참여자가 아니면 못 고치고 못 봄
    expect((await other.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [b] })).error?.code).toBe("42501");
    expect((await getCourse(other.supabase, meetupId)).stops).toEqual([]);
  }, 30_000);

  it("보던 순서와 다르면(남이 먼저 바꿈) 거절, 같은 순서면 바뀐 것 없음", async () => {
    const host = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const meetupId = m!.id as string;
    const [a, b, c] = await makePlaces(3);
    expect((await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [a], p_expected: "" })).data).toBe(true);
    // 'a' 를 본 사람이 b 를 담는 사이, 다른 쪽은 '' 을 보고 c 를 담으려 함 → 거절
    expect((await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [a, b], p_expected: a })).data).toBe(true);
    expect((await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [c], p_expected: a })).error?.code).toBe("P0003");
    expect((await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [a, b], p_expected: a })).data).toBe(false);
  }, 30_000);

  it("5곳 넘게 · 같은 곳 두 번은 거절, 직접 쓰기는 막힘", async () => {
    const host = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const meetupId = m!.id as string;
    const ids = await makePlaces(6);

    expect((await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: ids })).error?.code).toBe("P0001");
    expect((await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [ids[0], ids[0]] })).error?.code).toBe("22023");
    expect((await host.supabase.from("meetup_course").insert({ meetup_id: meetupId, place_id: ids[0], position: 0 })).error).not.toBeNull();
    expect(
      (await host.supabase.from("meetup_course_route").insert({ meetup_id: meetupId, course_key: "x", legs: [], path: [] })).error,
    ).not.toBeNull();
  }, 30_000);

  it("서버가 저장한 길은 지금 순서일 때만 쓰고, 순서가 바뀌면 지운다", async () => {
    const host = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const meetupId = m!.id as string;
    const [a, b] = await makePlaces(2);
    await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [a, b] });
    const admin = testAdminClient();
    const legs = [{ meters: 650, seconds: 540 }];
    const path = [[126.99, 37.56], [126.99, 37.562]];
    // 사용자는 길 저장 함수를 못 부르고, 서버도 지금 순서가 아닌 길은 못 쓴다
    expect((await host.supabase.rpc("save_meetup_course_route", { p_meetup: meetupId, p_key: `${a},${b}`, p_legs: legs, p_path: path })).error).not.toBeNull();
    expect((await admin.rpc("save_meetup_course_route", { p_meetup: meetupId, p_key: `${b},${a}`, p_legs: legs, p_path: path })).data).toBe(false);
    expect((await admin.rpc("save_meetup_course_route", { p_meetup: meetupId, p_key: `${a},${b}`, p_legs: legs, p_path: path })).data).toBe(true);
    expect((await getCourse(host.supabase, meetupId)).route).toMatchObject({ estimated: false, legs: [{ meters: 650, seconds: 540 }] });

    await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [b, a] });
    expect((await testAdminClient().from("meetup_course_route").select("meetup_id").eq("meetup_id", meetupId)).data).toEqual([]);
    expect((await getCourse(host.supabase, meetupId)).route?.estimated).toBe(true);
  }, 30_000);

  it("만날 곳 › 1차 길은 서버만 · 지금 만날 곳과 1차일 때만 저장 (88)", async () => {
    const host = await signUpTestUser();
    const { data: m } = await host.supabase.from("meetups").insert({ host_id: host.userId, purpose: "meal" }).select("id").single();
    const meetupId = m!.id as string;
    const [a, b] = await makePlaces(2);
    await host.supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: [a, b] });
    await host.supabase.rpc("set_meet_point", { p_meetup: meetupId, p_label: "역", p_lat: 37.55, p_lng: 126.99, p_area: null });
    const admin = testAdminClient();
    const save = (place: string, lat: number) =>
      admin.rpc("save_meet_walk", { p_meetup: meetupId, p_place: place, p_lat: lat, p_lng: 126.99, p_meters: 1400, p_seconds: 1100 });
    // 사용자는 못 부름
    expect((await host.supabase.rpc("save_meet_walk", { p_meetup: meetupId, p_place: a, p_lat: 37.55, p_lng: 126.99, p_meters: 1, p_seconds: 1 })).error).not.toBeNull();
    expect((await save(b, 37.55)).data).toBe(false);
    expect((await save(a, 37.54)).data).toBe(false);
    expect((await save(a, 37.55)).data).toBe(true);
    expect((await getCourse(host.supabase, meetupId)).meetWalk).toEqual({ placeId: a, lat: 37.55, lng: 126.99, meters: 1400, seconds: 1100 });
    // 다른 사람은 못 읽음
    const other = await signUpTestUser();
    expect((await getCourse(other.supabase, meetupId)).meetWalk).toBeNull();
  }, 30_000);
});
