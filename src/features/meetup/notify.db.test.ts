import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signUpTestUser } from "@/test/localSupabase";

const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...(a as [])) } }));

// 약속 알림 받는 사람 · 문구 — 로컬 Supabase 에 실제로 써 본다 (`pnpm test:local-db`)
const url = process.env.SUPABASE_TEST_URL;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false } }) : null;

type Sent = { to: string; title: string; body: string; url: string };
function sent(): Sent[] {
  return sendNotification.mock.calls.map((c) => {
    const [sub, payload] = c as unknown as [{ endpoint: string }, string];
    return { to: sub.endpoint, ...JSON.parse(payload) };
  });
}

describe.skipIf(!admin)("notifyMeetup", () => {
  const users: { id: string; name: string; endpoint: string }[] = [];
  let meetupId = "";

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: secret,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-public",
      VAPID_PRIVATE_KEY: "test-private",
      VAPID_SUBJECT: "mailto:test@test.local",
    });
    for (let i = 0; i < 3; i++) {
      const { userId } = await signUpTestUser();
      const { data } = await admin!.from("profiles").select("nickname").eq("id", userId).single();
      const endpoint = `https://push.example/${userId}`;
      await admin!.from("push_subscriptions").insert({ user_id: userId, endpoint, p256dh: "k", auth: "a" });
      users.push({ id: userId, name: data!.nickname as string, endpoint });
    }
    const { data } = await admin!.from("meetups").insert({ host_id: users[0].id, purpose: "drinks" }).select("id").single();
    meetupId = data!.id as string;
  });

  afterAll(async () => {
    for (const u of users) await admin!.auth.admin.deleteUser(u.id);
  });

  beforeEach(() => sendNotification.mockClear());

  it("초대받은 사람에게만 · 위치는 싣지 않음", async () => {
    const { notifyMeetup } = await import("./notify");
    await notifyMeetup(meetupId, users[0].id, { kind: "invited", to: users[1].id });
    expect(sent()).toEqual([{ to: users[1].endpoint, title: "약속 초대", body: `${users[0].name}님이 약속에 초대했어요`, url: `/meet/${meetupId}`, tag: `invite-${meetupId}` }]);
  });

  it("닉네임이 '님'으로 끝나면 '님'을 겹쳐 붙이지 않음 (66)", async () => {
    const { notifyMeetup } = await import("./notify");
    const nick = `손님${Math.random().toString(36).slice(2, 6)}님`;
    await admin!.from("profiles").update({ nickname: nick }).eq("id", users[0].id);
    await notifyMeetup(meetupId, users[0].id, { kind: "invited", to: users[1].id });
    expect(sent()[0].body).toBe(`${nick}이 약속에 초대했어요`);
    await admin!.from("profiles").update({ nickname: users[0].name }).eq("id", users[0].id);
  });

  it("참여하면 나머지 참여자에게 · 다시 열어도 한 번만", async () => {
    const { notifyMeetup } = await import("./notify");
    await admin!.from("meetup_members").insert({ meetup_id: meetupId, user_id: users[1].id });
    await notifyMeetup(meetupId, users[1].id, { kind: "joined" });
    expect(sent().map((s) => s.to)).toEqual([users[0].endpoint]);
    expect(sent()[0].body).toBe(`${users[1].name}님이 참여했어요`);

    sendNotification.mockClear();
    await admin!.from("meetup_members").update({ joined_at: new Date(Date.now() - 600_000).toISOString() }).eq("meetup_id", meetupId).eq("user_id", users[1].id);
    await notifyMeetup(meetupId, users[1].id, { kind: "joined" });
    expect(sent()).toHaveLength(0);
  });

  it("위치는 두 명 이상 넣었을 때, 위치를 넣은 사람에게만", async () => {
    const { notifyMeetup } = await import("./notify");
    await admin!.from("meetup_members").insert({ meetup_id: meetupId, user_id: users[2].id });
    await admin!.from("meetup_points").insert({ meetup_id: meetupId, user_id: users[0].id, kind: "return", label: "망원동", lat: 37.55, lng: 126.9 });
    await notifyMeetup(meetupId, users[0].id, { kind: "located" });
    expect(sent()).toHaveLength(0);

    await admin!.from("meetup_points").insert({ meetup_id: meetupId, user_id: users[1].id, kind: "origin", label: "잠실", lat: 37.51, lng: 127.1 });
    await notifyMeetup(meetupId, users[1].id, { kind: "located" });
    expect(sent().map((s) => s.to)).toEqual([users[0].endpoint]);
    expect(sent()[0].body).toBe(`${users[1].name}님이 위치를 넣어 추천 지역이 나왔어요`);
    expect(JSON.stringify(sent())).not.toContain("잠실");
    expect(JSON.stringify(sent())).not.toContain("술");
  });

  it("끝난 약속은 알리지 않음", async () => {
    const { notifyMeetup } = await import("./notify");
    await admin!.from("meetups").update({ status: "done" }).eq("id", meetupId);
    await notifyMeetup(meetupId, users[2].id, { kind: "joined" });
    expect(sent()).toHaveLength(0);
  });
});
