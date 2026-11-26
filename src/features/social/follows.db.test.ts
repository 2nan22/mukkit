import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signUpTestUser, testAdminClient } from "@/test/localSupabase";
import { getFollowList, getMyFollowingIds } from "./follows";

// 팔로워 · 팔로잉 목록 (74) — 보는 사람 권한으로 실제 로컬 DB 에서 (`pnpm test:local-db`)
const ready = Boolean(process.env.SUPABASE_TEST_URL && process.env.SUPABASE_TEST_SECRET_KEY);

describe.skipIf(!ready)("getFollowList", () => {
  // 0: 목록 주인 · 1, 2: 0 을 팔로우 · 3: 0 이 팔로우 · 4: 보는 사람(2 를 차단)
  const users: { id: string; client: SupabaseClient }[] = [];

  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      const { supabase, userId } = await signUpTestUser();
      users.push({ id: userId, client: supabase });
    }
    const admin = testAdminClient();
    await admin.from("profiles").update({ bio: "국밥 좋아해요" }).eq("id", users[1].id);
    await admin.from("follows").insert([
      { follower_id: users[1].id, followee_id: users[0].id },
      { follower_id: users[2].id, followee_id: users[0].id },
      { follower_id: users[0].id, followee_id: users[3].id },
      { follower_id: users[4].id, followee_id: users[1].id },
    ]);
    await admin.from("blocks").insert({ blocker_id: users[4].id, blocked_id: users[2].id });
  });

  afterAll(async () => {
    const admin = testAdminClient();
    for (const u of users) await admin.auth.admin.deleteUser(u.id);
  });

  it("남의 팔로워 · 팔로잉을 읽고, 공개 칸만 돌려준다", async () => {
    const followers = await getFollowList(users[3].client, users[0].id, "followers");
    expect(followers.map((p) => p.id).sort()).toEqual([users[1].id, users[2].id].sort());
    expect(followers.find((p) => p.id === users[1].id)?.bio).toBe("국밥 좋아해요");
    expect(Object.keys(followers[0]).sort()).toEqual(["bio", "id", "nickname"]);
    const following = await getFollowList(users[3].client, users[0].id, "following");
    expect(following.map((p) => p.id)).toEqual([users[3].id]);
  });

  it("차단한 사이는 목록에서 빠진다", async () => {
    const followers = await getFollowList(users[4].client, users[0].id, "followers");
    expect(followers.map((p) => p.id)).toEqual([users[1].id]);
  });

  it("내 팔로잉 표시", async () => {
    expect([...(await getMyFollowingIds(users[4].client, users[4].id))]).toEqual([users[1].id]);
  });
});
