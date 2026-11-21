"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { addPlaces } from "@/features/lists/lists";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return { supabase, me };
}

// 남의 평가로 알게 된 곳 — 내 저장에 '가고 싶은 곳' 으로
export async function saveWantToGo(placeId: string): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(placeId).success) return { error: "장소를 찾을 수 없어요." };
  const { supabase, me } = await requireUser();
  const { error } = await supabase
    .from("user_places")
    .upsert({ user_id: me, place_id: placeId, tier: "want_to_go" }, { onConflict: "user_id,place_id", ignoreDuplicates: true });
  if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  revalidatePath(`/p/${placeId}`);
  return {};
}

export async function savePlaceToList(placeId: string, listId: string): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(placeId).success || !z.uuid().safeParse(listId).success) return { error: "저장하지 못했어요." };
  const { supabase, me } = await requireUser();
  try {
    await supabase
      .from("user_places")
      .upsert({ user_id: me, place_id: placeId, tier: "want_to_go" }, { onConflict: "user_id,place_id", ignoreDuplicates: true });
    await addPlaces(supabase, me, listId, [placeId]);
  } catch {
    return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  }
  revalidatePath(`/p/${placeId}`);
  revalidatePath(`/lists/${listId}`);
  return {};
}
