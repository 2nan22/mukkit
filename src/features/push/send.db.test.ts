import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { signUpTestUser } from "@/test/localSupabase";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

// 로컬 Supabase 에 서비스 키로 실제로 써 본다 — `pnpm test:local-db`
const url = process.env.SUPABASE_TEST_URL;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false } }) : null;

describe.skipIf(!admin)("sendPush", () => {
  let userId = "";
  const ok = `https://push.example/ok-${Math.random()}`;
  const gone = `https://push.example/gone-${Math.random()}`;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.SUPABASE_SECRET_KEY = secret;
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "test-public";
    process.env.VAPID_PRIVATE_KEY = "test-private";
    process.env.VAPID_SUBJECT = "mailto:test@test.local";
    ({ userId } = await signUpTestUser());
    await admin!.from("push_subscriptions").insert([
      { user_id: userId, endpoint: ok, p256dh: "k", auth: "a" },
      { user_id: userId, endpoint: gone, p256dh: "k", auth: "a" },
    ]);
  });

  afterAll(async () => {
    if (userId) await admin!.auth.admin.deleteUser(userId);
  });

  it("보내고, 없어진 구독(410)은 지운다", async () => {
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === gone) throw Object.assign(new Error("gone"), { statusCode: 410 });
      return { statusCode: 201 };
    });
    const { sendPush } = await import("./send");
    const sent = await sendPush([userId, userId], { title: "약속", body: "테스트", url: "/meet" }, "meetup");
    expect(sent).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string)).toMatchObject({ title: "약속", url: "/meet" });
    const { data } = await admin!.from("push_subscriptions").select("endpoint, last_used_at").eq("user_id", userId);
    expect(data).toHaveLength(1);
    expect(data![0].endpoint).toBe(ok);
    expect(data![0].last_used_at).not.toBeNull();
  });

  it("그 종류를 끈 사람에게는 보내지 않는다", async () => {
    sendNotification.mockClear();
    sendNotification.mockResolvedValue({ statusCode: 201 });
    await admin!.from("profiles").update({ push_off: ["comment"] }).eq("id", userId);
    const { sendPush } = await import("./send");
    expect(await sendPush([userId], { title: "새 댓글", body: "테스트", url: "/" }, "comment")).toBe(0);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(await sendPush([userId], { title: "약속", body: "테스트", url: "/meet" }, "meetup")).toBe(1);
  });
});
