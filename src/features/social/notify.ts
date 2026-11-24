import "server-only";
import { honor } from "@/domain/honor";
import { sendPush } from "@/features/push/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 새 팔로워 (66) — 맞팔로우할 수 있게. 같은 사람이 눌렀다 풀었다 해도 처음 한 번만
// (알림함 줄은 트리거가 같은 사람이면 하나만 만든다 — 그 줄이 방금 생긴 경우만 보낸다)
const FRESH_MS = 60_000;

export async function notifyFollow(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const [{ data: actor }, { data: note }] = await Promise.all([
    admin.from("profiles").select("nickname").eq("id", followerId).maybeSingle(),
    admin.from("notifications").select("created_at").eq("kind", "follow").eq("user_id", followeeId).eq("actor_id", followerId).maybeSingle(),
  ]);
  // 알림 줄이 없으면 차단한 사이 등으로 트리거가 건너뛴 것
  if (!actor || !note || Date.now() - new Date(note.created_at as string).getTime() > FRESH_MS) return;
  await sendPush([followeeId], { title: "새 팔로워", body: `${honor(actor.nickname as string)}이 팔로우했어요`, url: `/u/${followerId}`, tag: `follow-${followerId}` }, "follow");
}
