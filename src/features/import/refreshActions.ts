"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { IMPORT_TIERS, modeFromValue, type ImportMode } from "./importMode";
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
  return refreshSource(supabase, userId, list.data.source as PlaceSourceName, list.data.source_list_id as string, [`/lists/${listId}`]);
}

// 가져온 원본 관리 › ⋯ › 지금 새로 고치기 — 리스트가 없는 등급 리스트 원본도
// tier: 기록 없는 원본(예전에 등급을 매겨 가져온 것)을 처음 새로 고칠 때 새 곳에 줄 등급 — 이번부터 기록이 남는다
export async function refreshImportSource(source: string, sourceListId: string, tier?: string): Promise<{ error?: string; done?: string }> {
  const t = z
    .object({ source: z.enum(["naver", "kakao"]), sourceListId: z.string().min(1).max(200), tier: z.enum(IMPORT_TIERS).optional() })
    .safeParse({ source, sourceListId, tier });
  if (!t.success) return { error: "새로 고치지 못했어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const fallback = t.data.tier ? ({ kind: "tier", tier: t.data.tier } as const) : undefined;
  return refreshSource(supabase, userId, t.data.source, t.data.sourceListId, ["/import/sources"], fallback);
}

// 원본 다시 읽기 — 1시간 간격 · 직접 누르면 실패 횟수를 지워 새벽 작업도 다시 시작
async function refreshSource(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  source: PlaceSourceName,
  sourceListId: string,
  paths: string[],
  fallback?: ImportMode,
): Promise<{ error?: string; done?: string }> {
  const src = await supabase
    .from("import_sources")
    .select("mode, tier, last_synced_at, status")
    .eq("user_id", userId)
    .eq("source", source)
    .eq("source_list_id", sourceListId)
    .maybeSingle();
  const last = src.data?.last_synced_at ? new Date(src.data.last_synced_at as string).getTime() : 0;
  if (Date.now() - last < COOLDOWN_MS) return { done: "조금 전에 확인했어요. 잠시 뒤에 다시 눌러 주세요." };
  if (src.data) await supabase.from("import_sources").update({ fail_count: 0 }).eq("user_id", userId).eq("source", source).eq("source_list_id", sourceListId);

  const mode: ImportMode = src.data
    ? src.data.mode === "tier" && src.data.tier
      ? modeFromValue(src.data.tier as string)
      : { kind: "plain" }
    : (fallback ?? { kind: "plain" });
  const res = await refreshImport(supabase, userId, { source, sourceListId, mode }).catch(() => ({ status: "error" as const }));
  for (const p of [...paths, "/lists", "/import/sources"]) revalidatePath(p);
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
