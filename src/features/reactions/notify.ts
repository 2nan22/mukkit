import "server-only";
import { honor } from "@/domain/honor";
import { claimFreshNotifications } from "@/features/push/claim";
import { sendPush } from "@/features/push/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { commentsHref } from "./reactions";

// 새 댓글 — 남이 쓰면 평가 주인에게, 주인이 쓰면 앞서 댓글 단 사람들에게. 장소 이름 · 댓글 내용은 싣지 않는다 (잠금 화면)
export async function notifyComment(authorId: string, ownerId: string, placeId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: author } = await admin.from("profiles").select("nickname").eq("id", authorId).maybeSingle();
  if (!author) return;
  const who = honor(author.nickname as string);
  const url = commentsHref(ownerId, placeId);
  const tag = `comments-${ownerId}-${placeId}`;
  if (authorId !== ownerId) {
    await sendPush([ownerId], { title: "새 댓글", body: `${who}이 내 평가에 댓글을 남겼어요`, url, tag }, "comment");
    return;
  }
  const { data: earlier } = await admin.from("rating_comments").select("author_id").eq("owner_id", ownerId).eq("place_id", placeId).neq("author_id", ownerId);
  const ids = [...new Set((earlier ?? []).map((r) => r.author_id as string))];
  if (ids.length === 0) return;
  // 그 사이 차단한 사이면 보내지 않는다
  const { data: blocked } = await admin
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(`blocker_id.eq.${ownerId},blocked_id.eq.${ownerId}`);
  const cut = new Set((blocked ?? []).flatMap((b) => [b.blocker_id as string, b.blocked_id as string]));
  const viewers = await stillViewing(admin, ownerId, placeId, ids.filter((id) => !cut.has(id)));
  await sendPush(viewers, { title: "새 댓글", body: `${who}이 자기 평가에 댓글을 남겼어요`, url, tag }, "comment");
}

// 새 좋아요 (71) — 평가 주인에게. 같은 사람이 같은 평가에 다시 눌러도 처음 한 번만(알림함 줄이 하나라서)
// 한 사람이 여러 평가를 잇달아 누르면 30분에 한 번만 푸시, 나머지는 알림함에만
// 같은 평가의 푸시는 tag 가 같아 기기에서 앞 알림을 바꿔 끼운다 — '○○님 외 N명'
const LIKE_PUSH_GAP_MS = 30 * 60_000;

export async function notifyLike(likerId: string, ownerId: string, placeId: string): Promise<void> {
  if (likerId === ownerId) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const since = new Date(Date.now() - LIKE_PUSH_GAP_MS).toISOString();
  const { count: recent } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("kind", "like")
    .eq("actor_id", likerId)
    .eq("user_id", ownerId)
    .gt("pushed_at", since);
  if ((recent ?? 0) > 0) return;
  // 줄이 없으면 차단한 사이 · 이미 알린 좋아요 등으로 트리거가 건너뛴 것
  const claimed = await claimFreshNotifications(admin, "like", likerId, { user_id: ownerId, place_id: placeId });
  if (claimed.length === 0) return;
  const [{ data: actor }, { count: likes }] = await Promise.all([
    admin.from("profiles").select("nickname").eq("id", likerId).maybeSingle(),
    admin.from("rating_likes").select("user_id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("place_id", placeId),
  ]);
  if (!actor) return;
  const who = honor(actor.nickname as string);
  const others = Math.max(0, (likes ?? 1) - 1);
  const body = others > 0 ? `${who} 외 ${others}명이 내 평가를 좋아해요` : `${who}이 내 평가를 좋아해요`;
  await sendPush([ownerId], { title: "새 좋아요", body, url: commentsHref(ownerId, placeId), tag: `likes-${ownerId}-${placeId}` }, "like");
}

// 평가를 지금도 볼 수 있는 사람만 — 비공개로 바꿨거나 팔로우를 끊었거나 신고로 숨겨졌으면 뺀다 (can_view_rating 과 같은 기준)
async function stillViewing(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, ownerId: string, placeId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const [{ data: rating }, { data: hidden }] = await Promise.all([
    admin.from("user_places").select("visibility").eq("user_id", ownerId).eq("place_id", placeId).maybeSingle(),
    admin.rpc("is_rating_hidden", { p_owner: ownerId, p_place: placeId }),
  ]);
  if (!rating || hidden === true || rating.visibility === "private") return [];
  if (rating.visibility === "public") return ids;
  const { data: followers } = await admin.from("follows").select("follower_id").eq("followee_id", ownerId).in("follower_id", ids);
  return (followers ?? []).map((f) => f.follower_id as string);
}
