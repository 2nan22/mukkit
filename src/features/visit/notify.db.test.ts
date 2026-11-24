import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signUpTestUser } from "@/test/localSupabase";

const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...(a as [])) } }));

// 함께 방문 태그 푸시 — 로컬 Supabase (`pnpm test:local-db`) (66)
const url = process.env.SUPABASE_TEST_URL;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false } }) : null;

function sent(): { to: string; title: string; body: string; url: string }[] {
  return sendNotification.mock.calls.map((c) => {
    const [sub, payload] = c as unknown as [{ endpoint: string }, string];
    return { to: sub.endpoint, ...JSON.parse(payload) };
  });
}

describe.skipIf(!admin)("notifyVisitTag", () => {
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

  it("태그된 사람에게 · 장소 이름은 싣지 않음", async () => {
    const { notifyVisitTag } = await import("./notify");
    await notifyVisitTag(users[0].id, [users[1].id, users[2].id]);
    expect(sent().map((s) => s.to).sort()).toEqual([users[1].endpoint, users[2].endpoint].sort());
    expect(sent()[0]).toMatchObject({ title: "함께 방문 요청", body: `${users[0].name}님이 함께 갔다고 남겼어요`, url: "/visits" });
  });

  it("함께 방문 알림을 끈 사람은 빼고", async () => {
    await admin!.from("profiles").update({ push_off: ["visit"] }).eq("id", users[2].id);
    const { notifyVisitTag } = await import("./notify");
    await notifyVisitTag(users[0].id, [users[1].id, users[2].id]);
    expect(sent().map((s) => s.to)).toEqual([users[1].endpoint]);
  });
});
