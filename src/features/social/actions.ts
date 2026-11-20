"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { follow, unfollow } from "./social";

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
  revalidatePath(`/u/${targetId}`);
  revalidatePath("/home");
  return {};
}
