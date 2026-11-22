import type { SupabaseClient } from "@supabase/supabase-js";

// 평가 하나의 좋아요 · 댓글 — 평가를 볼 수 있는 사람만 (rating_reactions · rating_comments_of)
export type CommentPreview = { id: string; authorId: string; nickname: string; body: string };
export type Reaction = { likes: number; liked: boolean; comments: number; preview: CommentPreview[] };
export type RatingKey = { ownerId: string; placeId: string };
export type RatingComment = { id: string; authorId: string; nickname: string; body: string; createdAt: string; mine: boolean; canDelete: boolean };

export const reactionKey = (ownerId: string, placeId: string) => `${ownerId}:${placeId}`;
export const commentsHref = (ownerId: string, placeId: string) => `/p/${placeId}/r/${ownerId}`;

export async function getReactions(supabase: SupabaseClient, keys: RatingKey[]): Promise<Map<string, Reaction>> {
  const out = new Map<string, Reaction>();
  if (keys.length === 0) return out;
  const { data, error } = await supabase.rpc("rating_reactions", { p_owners: keys.map((k) => k.ownerId), p_places: keys.map((k) => k.placeId) });
  if (error) throw new Error(`좋아요 · 댓글 수 조회 실패: ${error.code}`);
  for (const r of data as { owner_id: string; place_id: string; likes: number; liked: boolean; comments: number; preview: CommentPreview[] }[]) {
    out.set(reactionKey(r.owner_id, r.place_id), { likes: r.likes, liked: r.liked, comments: r.comments, preview: r.preview ?? [] });
  }
  return out;
}

export async function getComments(supabase: SupabaseClient, ownerId: string, placeId: string): Promise<RatingComment[]> {
  const { data, error } = await supabase.rpc("rating_comments_of", { p_owner: ownerId, p_place: placeId });
  if (error) throw new Error(`댓글 조회 실패: ${error.code}`);
  return (data as { id: string; author_id: string; nickname: string; body: string; created_at: string; mine: boolean; can_delete: boolean }[]).map((c) => ({
    id: c.id,
    authorId: c.author_id,
    nickname: c.nickname,
    body: c.body,
    createdAt: c.created_at,
    mine: c.mine,
    canDelete: c.can_delete,
  }));
}
