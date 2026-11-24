import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signUpTestUser } from "@/test/localSupabase";

const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...(a as [])) } }));

// 새 팔로워 푸시 — 로컬 Supabase (`pnpm test:local-db`) (66)
const url = process.env.SUPABASE_TEST_URL;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false } }) : null;

function sent(): { to: string; title: string; body: string; url: string }[] {
  return sendNotification.mock.calls.map((c) => {
    const [sub, payload] = c as unknown as [{ endpoint: string }, string];
    return { to: sub.endpoint, ...JSON.parse(payload) };
  });
}

describe.skipIf(!admin)("notifyFollow", () => {
  const users: { id: string; name: string; endpoint: string }[] = [];

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
  });

  afterAll(async () => {
    for (const u of users) await admin!.auth.admin.deleteUser(u.id);
  });

  beforeEach(() => sendNotification.mockClear());

  it("처음 팔로우하면 팔로우받은 사람에게", async () => {
    await admin!.from("follows").insert({ follower_id: users[0].id, followee_id: users[1].id });
    const { notifyFollow } = await import("./notify");
    await notifyFollow(users[0].id, users[1].id);
    expect(sent()).toEqual([{ to: users[1].endpoint, title: "새 팔로워", body: `${users[0].name}님이 팔로우했어요`, url: `/u/${users[0].id}`, tag: `follow-${users[0].id}` }]);
  });

  it("풀었다 다시 눌러도 다시 보내지 않음", async () => {
    await admin!.from("notifications").update({ created_at: new Date(Date.now() - 600_000).toISOString() }).eq("kind", "follow").eq("user_id", users[1].id);
    await admin!.from("follows").delete().eq("follower_id", users[0].id).eq("followee_id", users[1].id);
    await admin!.from("follows").insert({ follower_id: users[0].id, followee_id: users[1].id });
    const { notifyFollow } = await import("./notify");
    await notifyFollow(users[0].id, users[1].id);
    expect(sent()).toHaveLength(0);
  });

  it("빠르게 두 번 불러도 한 번만", async () => {
    const { notifyFollow } = await import("./notify");
    await admin!.from("follows").insert({ follower_id: users[1].id, followee_id: users[0].id });
    await Promise.all([notifyFollow(users[1].id, users[0].id), notifyFollow(users[1].id, users[0].id)]);
    expect(sent()).toHaveLength(1);
  });

  it("팔로우 알림을 끈 사람 · 차단한 사이는 빼고", async () => {
    await admin!.from("profiles").update({ push_off: ["follow"] }).eq("id", users[2].id);
    await admin!.from("follows").insert({ follower_id: users[0].id, followee_id: users[2].id });
    const { notifyFollow } = await import("./notify");
    await notifyFollow(users[0].id, users[2].id);
    expect(sent()).toHaveLength(0);

    // 차단 확인은 알림을 다시 켠 뒤에 — 끈 것 때문에 0건이 되는 거짓 통과를 막는다
    await admin!.from("profiles").update({ push_off: [] }).eq("id", users[2].id);
    await admin!.from("blocks").insert({ blocker_id: users[2].id, blocked_id: users[1].id });
    await admin!.from("follows").insert({ follower_id: users[1].id, followee_id: users[2].id });
    await notifyFollow(users[1].id, users[2].id);
    expect(sent()).toHaveLength(0);
  });
});
