"use server";

import { chunks } from "@/lib/supabase/inChunks";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicList } from "./publicList";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return { supabase, me };
}

// 리스트 저장 · 해제
export async function setListSaved(listId: string, on: boolean): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(listId).success) return { error: "저장하지 못했어요." };
  const { supabase, me } = await requireUser();
  const { error } = on
    ? await supabase.from("saved_lists").upsert({ user_id: me, list_id: listId }, { onConflict: "user_id,list_id", ignoreDuplicates: true })
    : await supabase.from("saved_lists").delete().eq("user_id", me).eq("list_id", listId);
  if (error) return { error: on ? "저장하지 못했어요. 다시 시도해 주세요." : "저장을 풀지 못했어요. 다시 시도해 주세요." };
  revalidatePath("/lists");
  return {};
}

// 리스트의 가게를 내 장소에 '가고 싶은 곳'으로 — 이미 저장한 곳은 그대로(등급 · 메모 유지)
// 장소는 그 리스트에 실제로 담긴 것만 받는다 (브라우저 값 불신)
export async function addToWantToGo(listId: string, placeIds: string[]): Promise<{ error?: string; added?: number }> {
  if (!z.uuid().safeParse(listId).success || !z.array(z.uuid()).min(1).max(20000).safeParse(placeIds).success) return { error: "담지 못했어요." };
  const { supabase, me } = await requireUser();
  const list = await getPublicList(supabase, listId);
  if (!list) return { error: "볼 수 없는 리스트예요." };
  const inList = new Set(list.places.map((p) => p.placeId));
  const ids = placeIds.filter((id) => inList.has(id));
  if (ids.length === 0) return { error: "담지 못했어요." };
  // 큰 리스트는 나눠 넣는다 — 한 번에 수천 행이면 요청 크기 · 시간 제한에 걸린다
  let added = 0;
  for (const part of chunks(ids, 500)) {
    const { data, error } = await supabase
      .from("user_places")
      .upsert(
        part.map((place_id) => ({ user_id: me, place_id, tier: "want_to_go" })),
        { onConflict: "user_id,place_id", ignoreDuplicates: true },
      )
      .select("place_id");
    if (error) {
      revalidatePath("/map");
      return added > 0 ? { error: `${added}곳까지 저장했어요. 나머지는 다시 시도해 주세요.`, added } : { error: "담지 못했어요. 다시 시도해 주세요." };
    }
    added += data?.length ?? 0;
  }
  revalidatePath("/map");
  return { added };
}
