import "server-only";
import { honor } from "@/domain/honor";
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
  await sendPush(viewers, { title: "새 댓글", body: `${who}이 댓글을 남겼어요`, url, tag }, "comment");
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
