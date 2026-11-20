"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { NicknameSchema } from "./nickname";

export type ProfileFormState = { error?: string };

const BIO_MAX = 150;
const ProfileSchema = z.object({
  nickname: NicknameSchema,
  bio: z.string().trim().max(BIO_MAX, `소개는 ${BIO_MAX}자까지예요`),
});

export async function saveProfile(_prev: ProfileFormState, formData: FormData): Promise<ProfileFormState> {
  const parsed = ProfileSchema.safeParse({ nickname: formData.get("nickname") ?? "", bio: formData.get("bio") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const { error } = await supabase
    .from("profiles")
    .update({ nickname: parsed.data.nickname, bio: parsed.data.bio || null, nickname_set_at: new Date().toISOString() })
    .eq("id", me);
  if (error) return { error: error.code === "23505" ? "이미 쓰는 닉네임이에요" : "저장하지 못했어요. 다시 시도해 주세요." };
  revalidatePath("/my");
  redirect("/my");
}
