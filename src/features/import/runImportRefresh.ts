import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { modeFromValue } from "./importMode";
import { refreshImport } from "./refreshImport";

export const JOB_NAME = "import_refresh";
// 하루에 다시 읽을 리스트 수 · 사이 쉬는 시간 — 원본(비공식 API)에 몰아서 부르지 않게
const PER_RUN = 60;
const PAUSE_MS = 1500;
// 크론 제한(300초) 안에서 끝나게
const BUDGET_MS = 240_000;

type Due = { user_id: string; source: PlaceSourceName; source_list_id: string; mode: "plain" | "tier"; tier: string | null };

// 매일 새벽 — 최근 30일 안에 쓴 사람의 가져온 리스트를 오래 확인 안 한 순으로 조금씩 다시 읽는다
export async function runImportRefresh(admin: SupabaseClient): Promise<{ ok: boolean; checked: number; detail: Record<string, number>; error?: string }> {
  const started = Date.now();
  const run = await admin.from("job_runs").insert({ job: JOB_NAME }).select("id").single();
  const detail: Record<string, number> = { unchanged: 0, updated: 0, unavailable: 0, error: 0, dropped: 0, added: 0, removed: 0, memos: 0 };
  let checked = 0;
  let error: string | undefined;
  try {
    const due = await admin.rpc("import_sources_due", { p_limit: PER_RUN });
    if (due.error) throw new Error(`import_sources_due ${due.error.code}`);
    for (const d of due.data as Due[]) {
      if (Date.now() - started > BUDGET_MS) break;
      const mode = d.mode === "tier" && d.tier ? modeFromValue(d.tier) : { kind: "plain" as const };
      const key = { source: d.source, sourceListId: d.source_list_id, mode };
      // 한 리스트가 실패해도 다음으로 — 실패로 남겨 내일은 뒤로 밀린다
      const res = await refreshImport(admin, d.user_id, key).catch(async () => {
        await admin
          .from("import_sources")
          .update({ status: "error", last_synced_at: new Date().toISOString() })
          .match({ user_id: d.user_id, source: d.source, source_list_id: d.source_list_id });
        return { status: "error" as const };
      });
      checked += 1;
      detail[res.status] = (detail[res.status] ?? 0) + 1;
      if (res.status === "updated") {
        detail.added += res.added;
        detail.removed += res.removed;
        detail.memos += res.memos;
      }
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  if (run.data) {
    await admin
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: !error, checked, closed: detail.removed, reopened: detail.added, detail, error: error ?? null })
      .eq("id", run.data.id);
  }
  return { ok: !error, checked, detail, error };
}
