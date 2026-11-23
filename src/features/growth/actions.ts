"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isCharacterId } from "@/components/growth/Character";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 함께 클 캐릭터 고르기 · 바꾸기 — 점수는 그대로, 모습만 바뀐다
export async function chooseCharacter(id: string): Promise<{ error?: string }> {
  if (!isCharacterId(id)) return { error: "고를 수 없는 캐릭터예요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const { error } = await supabase.from("profiles").update({ growth_character: id }).eq("id", me);
  if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  revalidatePath("/my");
  revalidatePath("/my/growth");
  return {};
}
