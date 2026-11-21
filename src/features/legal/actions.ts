"use server";

import { redirect } from "next/navigation";
import { safeNextPath, SESSION_ENDED, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TERMS_VERSION } from "./legal";

export type AgreeState = { error?: string };

export async function agreeToTerms(_prev: AgreeState, formData: FormData): Promise<AgreeState> {
  if (formData.get("agree") !== "on") return { error: "동의해야 계속 쓸 수 있어요" };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ terms_agreed_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq("id", me)
    .select("id");
  if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  // 0줄이면 계정이 없는 것 — 같은 화면으로 돌아오는 반복 대신 로그아웃
  if (!saved?.length) redirect(SESSION_ENDED);
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}
