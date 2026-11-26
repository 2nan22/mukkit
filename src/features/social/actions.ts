"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyFollow } from "./notify";
import { getReactions, reactionKey, type Reaction } from "@/features/reactions/reactions";
import { follow, getFeed, unfollow, type FeedCursor, type SharedRating } from "./social";

export async function setFollow(targetId: string, on: boolean): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(targetId).success) return { error: "사람을 찾을 수 없어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(`/?next=/u/${targetId}`);
  try {
    if (on) await follow(supabase, me, targetId);
    else await unfollow(supabase, me, targetId);
  } catch {
    return { error: "처리하지 못했어요. 다시 시도해 주세요." };
  }
  if (on) after(() => notifyFollow(me, targetId).catch(() => console.warn("[push] 팔로우 알림 실패")));
  revalidatePath(`/u/${targetId}`);
  revalidatePath("/home");
  return {};
}

const FeedCursorSchema = z.object({ ratedAt: z.string().min(1).max(40), ownerId: z.uuid(), placeId: z.uuid() });

// 피드 더 보기 (70) — 앞 쪽 마지막 카드 다음 20개와 그 좋아요 · 댓글
export async function loadMoreFeed(cursor: FeedCursor): Promise<{ items?: { rating: SharedRating; reaction: Reaction | null }[]; error?: string }> {
  const parsed = FeedCursorSchema.safeParse(cursor);
  if (!parsed.success) return { error: "불러오지 못했어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return { error: "다시 로그인해 주세요." };
  try {
    const feed = await getFeed(supabase, { after: parsed.data, mine: true });
    const reactions = await getReactions(supabase, feed);
    return { items: feed.map((rating) => ({ rating, reaction: reactions.get(reactionKey(rating.ownerId, rating.placeId)) ?? null })) };
  } catch {
    return { error: "불러오지 못했어요." };
  }
}
