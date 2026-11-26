import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetchAll";

// 팔로워 · 팔로잉 목록 (74) — 보는 사람 권한으로. 차단한 사이(어느 쪽이든)는 follows RLS 가 이미 뺀다
// profiles 는 공개 칸(닉네임 · 한 줄 소개)만
export type FollowKind = "followers" | "following";
export type FollowPerson = { id: string; nickname: string; bio: string };

type Row = {
  created_at: string;
  person: { id: string; nickname: string | null; bio: string | null } | null;
};

export async function getFollowList(
  supabase: SupabaseClient,
  userId: string,
  kind: FollowKind,
): Promise<FollowPerson[]> {
  // 팔로워 = 나를 팔로우한 사람(follower 쪽 프로필), 팔로잉 = 내가 팔로우한 사람(followee 쪽 프로필)
  const [mine, other, fk] =
    kind === "followers"
      ? (["followee_id", "follower_id", "follows_follower_id_fkey"] as const)
      : (["follower_id", "followee_id", "follows_followee_id_fkey"] as const);
  const { data, error } = await fetchAll<Row>((from, to) =>
    supabase
      .from("follows")
      .select(`created_at, person:profiles!${fk}(id, nickname, bio)`)
      .eq(mine, userId)
      // 최근에 팔로우한 순 · 같은 시각은 상대 id 로 고정 (쪽 나눔이 겹치지 않게)
      .order("created_at", { ascending: false })
      .order(other, { ascending: true })
      .range(from, to)
      .returns<Row[]>(),
  );
  if (error) throw new Error(`팔로우 목록 조회 실패: ${error.code}`);
  return data.flatMap((r) =>
    r.person?.nickname
      ? [
          {
            id: r.person.id,
            nickname: r.person.nickname,
            bio: r.person.bio ?? "",
          },
        ]
      : [],
  );
}

// 내가 팔로우하는 사람 — 목록 줄마다 팔로우 버튼 상태
export async function getMyFollowingIds(
  supabase: SupabaseClient,
  me: string,
): Promise<Set<string>> {
  const { data, error } = await fetchAll<{ followee_id: string }>((from, to) =>
    supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", me)
      .order("followee_id")
      .range(from, to)
      .returns<{ followee_id: string }[]>(),
  );
  if (error) throw new Error(`팔로잉 조회 실패: ${error.code}`);
  return new Set(data.map((r) => r.followee_id));
}
