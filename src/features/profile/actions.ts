"use server";

import { redirect, RedirectType } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath, SESSION_ENDED, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { agreedAll, TERMS_VERSION } from "@/features/legal/legal";
import { NicknameSchema } from "./nickname";

export type NicknameFormState = { error?: string; value?: string };

const UNIQUE_VIOLATION = "23505";

export async function saveNickname(_prev: NicknameFormState, formData: FormData): Promise<NicknameFormState> {
  const raw = String(formData.get("nickname") ?? "");
  const parsed = NicknameSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, value: raw };
  if (!agreedAll(formData, ["age", "terms", "privacy"])) return { error: "필수 항목에 모두 동의해 주세요.", value: raw };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME, RedirectType.replace);

  const { data: saved, error } = await supabase
    .from("profiles")
    .update({ nickname: parsed.data, nickname_set_at: new Date().toISOString(), terms_agreed_at: new Date().toISOString(), terms_version: TERMS_VERSION })
    .eq("id", userId)
    .select("id");
  if (error) {
    return {
      error: error.code === UNIQUE_VIOLATION ? "이미 쓰는 닉네임이에요" : "저장하지 못했어요. 다시 시도해 주세요.",
      value: parsed.data,
    };
  }
  if (!saved?.length) redirect(SESSION_ENDED, RedirectType.replace);
  redirect(safeNextPath(String(formData.get("next") ?? "")), RedirectType.replace);
}
