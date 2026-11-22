"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REPORT_REASONS } from "./reasons";

type Result = { error?: string; done?: string };

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return { supabase, me };
}

const ReportInput = z.object({
  userId: z.uuid(),
  placeId: z.uuid().nullable(),
  commentId: z.uuid().nullable().default(null),
  reason: z.enum(REPORT_REASONS),
  note: z.string().trim().max(300),
});

// 사람 또는 그 사람의 한 평가(사진 포함) 신고 — 같은 대상은 한 번만
export async function report(input: z.input<typeof ReportInput>): Promise<Result> {
  const parsed = ReportInput.safeParse(input);
  if (!parsed.success) return { error: "신고하지 못했어요." };
  const { supabase, me } = await requireUser();
  const p = parsed.data;
  if (p.userId === me) return { error: "내 평가는 신고할 수 없어요." };
  // 댓글 신고는 댓글만 가리킨다 (평가 숨김에 세지 않음)
  const { error } = await supabase.from("reports").insert({
    reporter_id: me,
    target_user: p.userId,
    target_place: p.commentId ? null : p.placeId,
    target_comment: p.commentId,
    reason: p.reason,
    note: p.note,
  });
  if (error) return error.code === "23505" ? { done: "이미 신고했어요." } : { error: "신고하지 못했어요. 다시 시도해 주세요." };
  return { done: "신고했어요. 확인하고 조치할게요." };
}

export async function block(userId: string): Promise<Result> {
  if (!z.uuid().safeParse(userId).success) return { error: "차단하지 못했어요." };
  const { supabase, me } = await requireUser();
  if (userId === me) return { error: "나를 차단할 수 없어요." };
  const { error } = await supabase.from("blocks").upsert({ blocker_id: me, blocked_id: userId }, { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true });
  if (error) return { error: "차단하지 못했어요. 다시 시도해 주세요." };
  revalidatePath("/", "layout");
  return { done: "차단했어요." };
}

export async function unblock(userId: string): Promise<Result> {
  if (!z.uuid().safeParse(userId).success) return { error: "해제하지 못했어요." };
  const { supabase, me } = await requireUser();
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", me).eq("blocked_id", userId);
  if (error) return { error: "해제하지 못했어요. 다시 시도해 주세요." };
  revalidatePath("/", "layout");
  return { done: "차단을 해제했어요." };
}
