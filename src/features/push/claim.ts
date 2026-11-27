import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// 알림함 트리거가 방금 만든 줄에서 푸시 받을 사람을 고른다 (66 코드 검토)
// - 차단한 사이 · 끝난 약속 · 되풀이(30분) 거르기를 트리거 한 곳에서 정하고 푸시는 그대로 따른다
// - pushed_at 을 조건부로 찍어 같은 줄로 두 번 보내지 않는다 (빠른 두 번 누르기 등)
const FRESH_MS = 120_000;

type Claimed = { user_id: string; first_ready: boolean | null; point_kind: string | null };

export async function claimFreshNotifications(
  admin: SupabaseClient,
  kind: "follow" | "meetup_join" | "meetup_ready" | "meetup_course",
  actorId: string,
  match: { user_id?: string; meetup_id?: string },
): Promise<Claimed[]> {
  let q = admin
    .from("notifications")
    .update({ pushed_at: new Date().toISOString() })
    .eq("kind", kind)
    .eq("actor_id", actorId)
    .is("pushed_at", null)
    .gt("created_at", new Date(Date.now() - FRESH_MS).toISOString());
  if (match.user_id) q = q.eq("user_id", match.user_id);
  if (match.meetup_id) q = q.eq("meetup_id", match.meetup_id);
  const { data } = await q.select("user_id, first_ready, point_kind");
  return (data ?? []) as Claimed[];
}
