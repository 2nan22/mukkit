"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result = { error?: string };

// 받은 태그 수락 · 거절 — 수락하면 내 등급을 남기러 평가 화면으로
export async function respondVisit(visitId: string, accept: boolean, showInFeed: boolean): Promise<Result> {
  if (!z.uuid().safeParse(visitId).success) return { error: "처리하지 못했어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const { data: placeId, error } = await supabase.rpc("respond_visit", { p_visit: visitId, p_accept: accept, p_show_in_feed: showInFeed });
  if (error) return { error: "이미 처리했거나 없어진 기록이에요." };
  revalidatePath("/", "layout");
  if (accept) redirect(`/rate/${placeId}?next=/visits`, RedirectType.push);
  return {};
}
