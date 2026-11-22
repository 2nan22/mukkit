import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportStatus = { status: "ok" | "unavailable" | "error"; lastSyncedAt: string | null };

// 가져온 리스트의 원본 확인 상태 — 마이슐랭 리스트 id 로
export async function getImportStatus(supabase: SupabaseClient, userId: string, listId: string): Promise<ImportStatus | null> {
  const list = await supabase.from("lists").select("source, source_list_id").eq("id", listId).eq("owner_id", userId).maybeSingle();
  if (!list.data?.source || !list.data.source_list_id) return null;
  const src = await supabase
    .from("import_sources")
    .select("status, last_synced_at")
    .eq("user_id", userId)
    .eq("source", list.data.source)
    .eq("source_list_id", list.data.source_list_id)
    .maybeSingle();
  if (!src.data) return null;
  return { status: src.data.status as ImportStatus["status"], lastSyncedAt: src.data.last_synced_at as string | null };
}
