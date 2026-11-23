import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAll } from "@/lib/supabase/fetchAll";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { IMPORT_TIERS, type ImportTier } from "./importMode";

export type ImportSourceRow = {
  source: PlaceSourceName;
  sourceListId: string;
  name: string;
  count: number;
  // 이 원본으로 만든 먹킷 리스트 (등급 리스트로 가져왔으면 없음)
  listId: string | null;
  // 새로 고침 기록 — 없으면 자동 새로 고침을 하지 않는 원본(25-2 전에 등급 리스트로 가져온 것)
  sync: { status: "ok" | "unavailable" | "error"; lastSyncedAt: string | null } | null;
  // 기록 없는 원본을 처음 새로 고칠 때 새 곳에 줄 등급 — 이 원본 장소들에 가장 많이 준 등급 (없으면 null)
  suggestedTier: ImportTier | null;
};

export class ImportSourceReadError extends Error {
  constructor(step: string, code?: string) {
    super(`가져온 원본을 읽지 못했어요: step=${step} code=${code ?? "unknown"}`);
    this.name = "ImportSourceReadError";
  }
}

// 가져온 원본 관리 — 원본 리스트마다 이름 · 곳 수 · 먹킷 리스트 · 마지막 확인 (많이 담긴 순)
export async function getImportSources(supabase: SupabaseClient, userId: string): Promise<ImportSourceRow[]> {
  const [items, lists, syncs, tiers] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("imported_items").select("source, source_list_id, list_name, place_id").eq("user_id", userId).order("source_list_id").order("source_place_id").range(from, to),
    ),
    supabase.from("lists").select("id, source, source_list_id").eq("owner_id", userId).not("source", "is", null),
    supabase.from("import_sources").select("source, source_list_id, status, last_synced_at").eq("user_id", userId),
    fetchAll((from, to) => supabase.from("user_places").select("place_id, tier").eq("user_id", userId).order("place_id").range(from, to)),
  ]);
  if (items.error) throw new ImportSourceReadError("items", items.error.code);
  if (lists.error) throw new ImportSourceReadError("lists", lists.error.code);
  if (syncs.error) throw new ImportSourceReadError("syncs", syncs.error.code);
  if (tiers.error) throw new ImportSourceReadError("tiers", tiers.error.code);
  const tierOf = new Map(tiers.data.map((t) => [t.place_id as string, t.tier as string]));
  const tally = new Map<string, Map<ImportTier, number>>();

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
      suggestedTier: null,
    };
    g.count += 1;
    groups.set(key, g);
    const t = tierOf.get(r.place_id as string);
    const it = IMPORT_TIERS.find((x) => x === t);
    if (it) {
      const m = tally.get(key) ?? new Map<ImportTier, number>();
      m.set(it, (m.get(it) ?? 0) + 1);
      tally.set(key, m);
    }
  }
  for (const [key, g] of groups) {
    const m = tally.get(key);
    if (!g.sync && m) g.suggestedTier = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

// 마지막 확인 한 줄 — '오늘 확인' · 'N일 전 확인' · 비공개 · 실패 (한국 시각 날짜 기준)
export function syncLine(sync: ImportSourceRow["sync"], now = Date.now()): { text: string; warn: boolean } {
  if (!sync) return { text: "새로 고친 적 없음", warn: false };
  if (sync.status === "unavailable") return { text: "원본이 비공개예요 · 공개 범위를 확인해 주세요", warn: true };
  // error 는 마지막 확인이 실패한 것 (다음 새벽에 다시)
  if (sync.status === "error") return { text: "최근 확인 실패 · 다시 시도해요", warn: true };
  if (!sync.lastSyncedAt) return { text: "확인 전", warn: false };
  // 날짜(달력) 기준 — 어제 밤 확인은 '어제'
  const day = (t: number) => Math.floor((t + 9 * 3_600_000) / 86_400_000);
  const days = day(now) - day(new Date(sync.lastSyncedAt).getTime());
  return { text: days <= 0 ? "오늘 확인" : days === 1 ? "어제 확인" : `${days}일 전 확인`, warn: false };
}
