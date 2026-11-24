import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signUpTestUser } from "@/test/localSupabase";

const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...(a as [])) } }));

// 새 댓글 푸시 받는 사람 · 문구 — 로컬 Supabase 에 실제로 써 본다 (`pnpm test:local-db`) (66)
const url = process.env.SUPABASE_TEST_URL;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false } }) : null;

type Sent = { to: string; title: string; body: string; url: string; tag: string };
function sent(): Sent[] {
  return sendNotification.mock.calls.map((c) => {
    const [sub, payload] = c as unknown as [{ endpoint: string }, string];
    return { to: sub.endpoint, ...JSON.parse(payload) };
  });
}

describe.skipIf(!admin)("notifyComment", () => {
  // 0: 평가 주인 · 1, 2: 댓글 단 사람 · 3: 주인을 차단한 사람
  const users: { id: string; name: string; endpoint: string }[] = [];
  let placeId = "";
  const PLACE = `시험가게-${Math.random().toString(36).slice(2, 6)}`;

  beforeAll(async () => {
    Object.assign(process.env, {
      NEXT_PUBLIC_SUPABASE_URL: url,
      SUPABASE_SECRET_KEY: secret,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test-public",
      VAPID_PRIVATE_KEY: "test-private",
      VAPID_SUBJECT: "mailto:test@test.local",
    });
    for (let i = 0; i < 4; i++) {
      const { userId } = await signUpTestUser();
      const { data } = await admin!.from("profiles").select("nickname").eq("id", userId).single();
      const endpoint = `https://push.example/${userId}`;
      await admin!.from("push_subscriptions").insert({ user_id: userId, endpoint, p256dh: "k", auth: "a" });
      users.push({ id: userId, name: data!.nickname as string, endpoint });
    }
    const { data: place } = await admin!
      .from("places")
      .insert({ name: PLACE, lat: 37.5, lng: 127, source: "kakao", source_place_id: `t-${Math.random()}`, cuisine: "korean" })
      .select("id")
      .single();
    placeId = place!.id as string;
    await admin!.from("user_places").insert({ user_id: users[0].id, place_id: placeId, tier: "two", visibility: "public" });
    await admin!.from("rating_comments").insert([
      { owner_id: users[0].id, place_id: placeId, author_id: users[1].id, body: "맛있어 보여요" },
      { owner_id: users[0].id, place_id: placeId, author_id: users[2].id, body: "저도 가 볼게요" },
      { owner_id: users[0].id, place_id: placeId, author_id: users[3].id, body: "좋네요" },
    ]);
    await admin!.from("blocks").insert({ blocker_id: users[3].id, blocked_id: users[0].id });
  });

  afterAll(async () => {
    for (const u of users) await admin!.auth.admin.deleteUser(u.id);
    if (placeId) await admin!.from("places").delete().eq("id", placeId);
  });

  beforeEach(() => sendNotification.mockClear());

  it("남이 쓰면 평가 주인에게만 · 장소 이름 · 댓글 내용은 싣지 않음", async () => {
    const { notifyComment } = await import("./notify");
    await notifyComment(users[1].id, users[0].id, placeId);
    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ to: users[0].endpoint, title: "새 댓글", body: `${users[1].name}님이 내 평가에 댓글을 남겼어요` });
    expect(JSON.stringify(sent())).not.toContain(PLACE);
    expect(JSON.stringify(sent())).not.toContain("맛있어");
  });

  it("주인이 쓰면 앞서 댓글 단 사람에게 · 차단한 사이는 빼고", async () => {
    const { notifyComment } = await import("./notify");
    await notifyComment(users[0].id, users[0].id, placeId);
    expect(sent().map((s) => s.to).sort()).toEqual([users[1].endpoint, users[2].endpoint].sort());
    expect(sent()[0].body).toBe(`${users[0].name}님이 자기 평가에 댓글을 남겼어요`);
  });

  it("댓글 알림을 끈 사람은 빼고", async () => {
    await admin!.from("profiles").update({ push_off: ["comment"] }).eq("id", users[2].id);
    const { notifyComment } = await import("./notify");
    await notifyComment(users[0].id, users[0].id, placeId);
    expect(sent().map((s) => s.to)).toEqual([users[1].endpoint]);
  });

  it("평가를 나만 보기로 바꾸면 앞서 댓글 단 사람에게도 안 보냄", async () => {
    await admin!.from("user_places").update({ visibility: "private" }).eq("user_id", users[0].id).eq("place_id", placeId);
    const { notifyComment } = await import("./notify");
    await notifyComment(users[0].id, users[0].id, placeId);
    expect(sent()).toHaveLength(0);
  });
});
