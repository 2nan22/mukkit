"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyComment } from "./notify";

type Result = { error?: string };

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return { supabase, me };
}

const Target = z.object({ ownerId: z.uuid(), placeId: z.uuid() });

export async function setLike(input: { ownerId: string; placeId: string; on: boolean }): Promise<Result> {
  const t = Target.safeParse(input);
  if (!t.success) return { error: "좋아요를 반영하지 못했어요." };
  const { supabase, me } = await requireUser();
  const { ownerId, placeId } = t.data;
  if (ownerId === me) return { error: "내 평가에는 좋아요를 누를 수 없어요." };
  const { error } = input.on
    ? await supabase.from("rating_likes").upsert({ user_id: me, owner_id: ownerId, place_id: placeId }, { onConflict: "user_id,owner_id,place_id", ignoreDuplicates: true })
    : await supabase.from("rating_likes").delete().eq("user_id", me).eq("owner_id", ownerId).eq("place_id", placeId);
  return error ? { error: "좋아요를 반영하지 못했어요. 다시 시도해 주세요." } : {};
}

const CommentInput = Target.extend({ body: z.string().trim().min(1).max(300) });

export async function addComment(input: { ownerId: string; placeId: string; body: string }): Promise<Result> {
  const p = CommentInput.safeParse(input);
  if (!p.success) return { error: input.body.trim() ? "댓글은 300자까지 쓸 수 있어요." : "댓글을 입력해 주세요." };
  const { supabase, me } = await requireUser();
  const { ownerId, placeId, body } = p.data;
  const { error } = await supabase.from("rating_comments").insert({ owner_id: ownerId, place_id: placeId, author_id: me, body });
  if (error) return { error: error.code === "42501" ? "이 평가에는 댓글을 남길 수 없어요." : "댓글을 남기지 못했어요. 다시 시도해 주세요." };
  after(() => notifyComment(me, ownerId, placeId).catch(() => console.warn("[push] 댓글 알림 실패")));
  return {};
}

export async function deleteComment(commentId: string): Promise<{ error?: string; done?: string }> {
  if (!z.uuid().safeParse(commentId).success) return { error: "댓글을 지우지 못했어요." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("rating_comments").delete().eq("id", commentId).select("id");
  if (error || !data?.length) return { error: "댓글을 지우지 못했어요. 다시 시도해 주세요." };
  return { done: "댓글을 지웠어요." };
}
