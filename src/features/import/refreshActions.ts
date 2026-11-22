"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { modeFromValue } from "./importMode";
import { refreshImport } from "./refreshImport";

// 직접 새로 고치기는 이만큼 지나야 다시 — 원본에 몰아서 부르지 않게
const COOLDOWN_MS = 60 * 60 * 1000;

// 가져온 리스트(그냥 저장한 리스트) 화면의 '원본에서 새로 고치기'
export async function refreshImportedList(listId: string): Promise<{ error?: string; done?: string }> {
  if (!z.uuid().safeParse(listId).success) return { error: "새로 고치지 못했어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);

  const list = await supabase.from("lists").select("source, source_list_id").eq("id", listId).eq("owner_id", userId).maybeSingle();
  if (!list.data?.source || !list.data.source_list_id) return { error: "가져온 리스트가 아니에요." };
  const src = await supabase
    .from("import_sources")
    .select("mode, tier, last_synced_at, status")
    .eq("user_id", userId)
    .eq("source", list.data.source)
    .eq("source_list_id", list.data.source_list_id)
    .maybeSingle();
  const last = src.data?.last_synced_at ? new Date(src.data.last_synced_at as string).getTime() : 0;
  if (Date.now() - last < COOLDOWN_MS) return { done: "조금 전에 확인했어요. 잠시 뒤에 다시 눌러 주세요." };
  // 직접 누르면 실패 횟수를 지워 새벽 작업도 다시 시작
  if (src.data) await supabase.from("import_sources").update({ fail_count: 0 }).eq("user_id", userId).eq("source", list.data.source).eq("source_list_id", list.data.source_list_id);

  const mode = src.data?.mode === "tier" && src.data.tier ? modeFromValue(src.data.tier as string) : { kind: "plain" as const };
  const res = await refreshImport(supabase, userId, { source: list.data.source as PlaceSourceName, sourceListId: list.data.source_list_id as string, mode }).catch(
    () => ({ status: "error" as const }),
  );
  revalidatePath(`/lists/${listId}`);
  revalidatePath("/lists");
  switch (res.status) {
    case "unchanged":
      return { done: "원본과 같아요. 바뀐 곳이 없어요." };
    case "updated": {
      const parts = [res.added && `새로 담은 곳 ${res.added}`, res.removed && `뺀 곳 ${res.removed}`, res.memos && `바뀐 메모 ${res.memos}`].filter(Boolean);
      return { done: parts.length ? `원본을 반영했어요 · ${parts.join(" · ")}` : "원본과 같아요. 바뀐 곳이 없어요." };
    }
    case "unavailable":
      return { error: "원본 리스트를 볼 수 없어요. 공개 범위를 확인해 주세요." };
    case "dropped":
      return { error: "가져온 리스트가 아니에요." };
    default:
      return { error: "원본을 제대로 불러오지 못해 반영하지 않았어요. 잠시 후 다시 시도해 주세요." };
  }
}
