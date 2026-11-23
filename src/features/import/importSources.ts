import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceSourceName } from "@/domain/importedPlace";

export type ImportSourceRow = {
  source: PlaceSourceName;
  sourceListId: string;
  name: string;
  count: number;
  // 이 원본으로 만든 먹킷 리스트 (등급 리스트로 가져왔으면 없음)
  listId: string | null;
  // 새로 고침 기록 — 없으면 자동 새로 고침을 하지 않는 원본(25-2 전에 등급 리스트로 가져온 것)
  sync: { status: "ok" | "unavailable" | "error"; lastSyncedAt: string | null } | null;
};

export class ImportSourceReadError extends Error {
  constructor(step: string, code?: string) {
    super(`가져온 원본을 읽지 못했어요: step=${step} code=${code ?? "unknown"}`);
    this.name = "ImportSourceReadError";
  }
}

// 가져온 원본 관리 — 원본 리스트마다 이름 · 곳 수 · 먹킷 리스트 · 마지막 확인 (많이 담긴 순)
export async function getImportSources(supabase: SupabaseClient, userId: string): Promise<ImportSourceRow[]> {
  const [items, lists, syncs] = await Promise.all([
    supabase.from("imported_items").select("source, source_list_id, list_name").eq("user_id", userId).limit(10000),
    supabase.from("lists").select("id, source, source_list_id").eq("owner_id", userId).not("source", "is", null),
    supabase.from("import_sources").select("source, source_list_id, status, last_synced_at").eq("user_id", userId),
  ]);
  if (items.error) throw new ImportSourceReadError("items", items.error.code);
  if (lists.error) throw new ImportSourceReadError("lists", lists.error.code);
  if (syncs.error) throw new ImportSourceReadError("syncs", syncs.error.code);

  const listOf = new Map(lists.data.map((l) => [`${l.source}:${l.source_list_id}`, l.id as string]));
  const syncOf = new Map(
    syncs.data.map((s) => [
      `${s.source}:${s.source_list_id}`,
      { status: s.status as "ok" | "unavailable" | "error", lastSyncedAt: (s.last_synced_at as string | null) ?? null },
    ]),
  );
  const groups = new Map<string, ImportSourceRow>();
  for (const r of items.data) {
    const key = `${r.source}:${r.source_list_id}`;
    const g = groups.get(key) ?? {
      source: r.source as PlaceSourceName,
      sourceListId: r.source_list_id as string,
      name: r.list_name as string,
      count: 0,
      listId: listOf.get(key) ?? null,
      sync: syncOf.get(key) ?? null,
    };
    g.count += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// 마지막 확인 한 줄 — '오늘 확인' · 'N일 전 확인' · 볼 수 없음
export function syncLine(sync: ImportSourceRow["sync"], now = Date.now()): { text: string; warn: boolean } {
  if (!sync) return { text: "새로 고침 안 함", warn: false };
  if (sync.status === "unavailable") return { text: "원본을 볼 수 없어요 · 공개 범위 확인", warn: true };
  if (!sync.lastSyncedAt) return { text: "확인 전", warn: false };
  const days = Math.floor((now - new Date(sync.lastSyncedAt).getTime()) / 86_400_000);
  return { text: days < 1 ? "오늘 확인" : `${days}일 전 확인`, warn: false };
}
