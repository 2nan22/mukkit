import type { SupabaseClient } from "@supabase/supabase-js";
import { checkKakaoPlaces, checkNaverLists } from "./checkers";

export const JOB_NAME = "closure_check";
const KAKAO_BATCH = 150;
const NAVER_LISTS = 10;
// 한 번에 이만큼 넘게 폐업으로 나오면 출처 쪽 이상으로 보고 바꾸지 않는다
const MAX_CLOSED_RATIO = 0.3;
const MIN_FOR_GUARD = 20;

export type ClosureCheckResult = { ok: boolean; checked: number; closed: number; reopened: number; detail: Record<string, unknown>; error?: string };

type Checkers = { kakao: typeof checkKakaoPlaces; naver: typeof checkNaverLists };

// 매일 새벽 — 확인한 지 오래된 카카오 장소 N곳 + 가져온 네이버 리스트 몇 개를 다시 읽어 폐업 여부를 갱신
export async function runClosureCheck(admin: SupabaseClient, checkers: Checkers = { kakao: checkKakaoPlaces, naver: checkNaverLists }): Promise<ClosureCheckResult> {
  const started = await admin.from("job_runs").insert({ job: JOB_NAME }).select("id").single();
  const runId = started.data?.id as number | undefined;
  let result: ClosureCheckResult;
  try {
    result = await check(admin, checkers);
  } catch (e) {
    result = { ok: false, checked: 0, closed: 0, reopened: 0, detail: {}, error: e instanceof Error ? e.message : String(e) };
  }
  if (runId !== undefined) {
    await admin
      .from("job_runs")
      .update({ finished_at: new Date().toISOString(), ok: result.ok, checked: result.checked, closed: result.closed, reopened: result.reopened, detail: result.detail, error: result.error ?? null })
      .eq("id", runId);
  }
  return result;
}

async function check(admin: SupabaseClient, checkers: Checkers): Promise<ClosureCheckResult> {
  // 카카오 — 확인한 지 오래된 순
  const kakaoRows = await admin
    .from("place_sources")
    .select("place_id, source_place_id, places!inner(source_checked_at)")
    .eq("source", "kakao")
    .order("source_checked_at", { referencedTable: "places", ascending: true })
    .limit(KAKAO_BATCH);
  if (kakaoRows.error) throw new Error(`kakao select ${kakaoRows.error.code}`);
  const kakaoByPid = new Map((kakaoRows.data as { place_id: string; source_place_id: string }[]).map((r) => [r.source_place_id, r.place_id]));
  const kakao = await checkers.kakao([...kakaoByPid.keys()]);

  // 네이버 — 가져온 공유 리스트 중 몇 개를 무작위로
  const listRows = await admin.from("imported_items").select("source_list_id").eq("source", "naver").limit(5000);
  if (listRows.error) throw new Error(`naver lists ${listRows.error.code}`);
  const listIds = shuffle([...new Set((listRows.data as { source_list_id: string }[]).map((r) => r.source_list_id))]).slice(0, NAVER_LISTS);
  const naver = await checkers.naver(listIds);
  const naverByPid = await placeIdsFor(admin, "naver", [...naver.results.keys()]);

  // 장소 ID 기준 판정
  const decided = new Map<string, boolean>();
  for (const [sid, open] of kakao.results) decided.set(kakaoByPid.get(sid)!, open);
  for (const [sid, open] of naver.results) {
    const pid = naverByPid.get(sid);
    if (pid) decided.set(pid, (decided.get(pid) ?? true) && open);
  }

  const before = await currentAvailability(admin, [...decided.keys()]);
  const closed = [...decided].filter(([pid, open]) => !open && before.get(pid) !== false).map(([pid]) => pid);
  const reopened = [...decided].filter(([pid, open]) => open && before.get(pid) === false).map(([pid]) => pid);
  const closedTotal = [...decided.values()].filter((v) => !v).length;
  const detail = { kakaoChecked: kakao.results.size, kakaoUnknown: kakao.unknown, naverLists: listIds.length, naverFailedLists: naver.failedLists, naverChecked: naver.results.size };

  if (decided.size >= MIN_FOR_GUARD && closedTotal / decided.size > MAX_CLOSED_RATIO) {
    return { ok: false, checked: decided.size, closed: 0, reopened: 0, detail: { ...detail, closedTotal }, error: "폐업 비율이 비정상적으로 높아 갱신하지 않음" };
  }

  const now = new Date().toISOString();
  await updatePlaces(admin, closed, { available: false, source_checked_at: now });
  await updatePlaces(admin, reopened, { available: true, source_checked_at: now });
  // 판정이 그대로거나 모름이어도 확인 시각은 남긴다 — 같은 곳만 계속 보지 않게
  const touched = [...new Set([...kakaoByPid.values(), ...decided.keys()])].filter((pid) => !closed.includes(pid) && !reopened.includes(pid));
  await updatePlaces(admin, touched, { source_checked_at: now });

  return { ok: true, checked: decided.size, closed: closed.length, reopened: reopened.length, detail };
}

async function placeIdsFor(admin: SupabaseClient, source: string, sids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const part of chunks(sids)) {
    const { data, error } = await admin.from("place_sources").select("place_id, source_place_id").eq("source", source).in("source_place_id", part);
    if (error) throw new Error(`place_sources ${error.code}`);
    for (const r of data as { place_id: string; source_place_id: string }[]) out.set(r.source_place_id, r.place_id);
  }
  return out;
}

async function currentAvailability(admin: SupabaseClient, ids: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  for (const part of chunks(ids)) {
    const { data, error } = await admin.from("places").select("id, available").in("id", part);
    if (error) throw new Error(`places ${error.code}`);
    for (const r of data as { id: string; available: boolean }[]) out.set(r.id, r.available);
  }
  return out;
}

async function updatePlaces(admin: SupabaseClient, ids: string[], values: Record<string, unknown>): Promise<void> {
  for (const part of chunks(ids)) {
    const { error } = await admin.from("places").update(values).in("id", part);
    if (error) throw new Error(`places update ${error.code}`);
  }
}

function chunks<T>(items: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
