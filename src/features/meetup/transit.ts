import "server-only";
import { parseTransit, type TransitResult } from "@/domain/transit";
import { timedFetch } from "@/lib/http/timedFetch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 카카오맵 대중교통 경로 (86) — 다른 길찾기로 바꿀 때 이 파일만
const TRANSIT_URL = "https://dapi.kakao.com/v2/routing/publictraffic";
// 하루 무료 1,000건 — 넘기 전에 멈추고 직선 어림으로 (사용자 결정 전 기본값, 도보 경로 몫을 남김)
const DAILY_CAP = 900;
const CONCURRENCY = 3;
// 재는 중 표시가 이보다 오래면 실패한 것으로 보고 다시 잰다
const STALE_PENDING_MIN = 10;

type Need = { from_cell: string; to_cell: string; from_lat: number; from_lng: number; to_lat: number; to_lng: number };
// 한 번에 이만큼만 — 나머지는 다음 화면 때 (함수 시간 제한 · pending 묶임 막기)
const PER_RUN = 12;
// 실패한 구간은 이만큼 뒤에 다시
const ERROR_RETRY_MIN = 60;

type Fetched = TransitResult | "error" | "stop";

async function fetchTransit(n: Need, key: string): Promise<Fetched> {
  const q = new URLSearchParams({ start_x: String(n.from_lng), start_y: String(n.from_lat), end_x: String(n.to_lng), end_y: String(n.to_lat) });
  try {
    const res = await timedFetch(`${TRANSIT_URL}?${q}`, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store" });
    if (!res.ok) {
      console.warn("[KAKAO TRANSIT] 조회 실패: status=%d", res.status);
      // 키 · 권한 · 카카오 쪽 한도 문제면 이번 실행은 멈춘다(남은 구간도 같은 결과)
      return [401, 403, 429].includes(res.status) ? "stop" : "error";
    }
    return parseTransit(await res.json()) ?? "error";
  } catch (e) {
    console.warn("[KAKAO TRANSIT] 네트워크 오류: %s", e instanceof Error ? e.name : "unknown");
    return "error";
  }
}

// 화면에 보여 줄 지역(areas)에서 아직 안 잰 구간만 잰다 — 화면을 그린 뒤(after) 부른다. 같은 구간은 칸 단위로 모든 약속이 같이 씀
// 재는 중 표시(pending)를 먼저 넣은 구간만 부르므로 두 사람이 동시에 열어도 한 번. 실패는 error 로 남겨 1시간 뒤에만 다시
export async function refreshMeetupTransit(meetupId: string, areas: string[]): Promise<number> {
  const key = process.env.KAKAO_REST_API_KEY;
  const admin = createSupabaseAdminClient();
  if (!key || !admin || areas.length === 0) return 0;
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  await admin.from("transit_legs").delete().eq("status", "pending").lt("fetched_at", ago(STALE_PENDING_MIN));
  await admin.from("transit_legs").delete().eq("status", "error").lt("fetched_at", ago(ERROR_RETRY_MIN));
  const { data: needs } = await admin.rpc("meetup_transit_needs", { p_meetup: meetupId, p_areas: areas });
  const list = ((needs ?? []) as Need[]).slice(0, PER_RUN);
  if (list.length === 0) return 0;
  const { data: claimed } = await admin
    .from("transit_legs")
    .upsert(
      list.map((n) => ({ from_cell: n.from_cell, to_cell: n.to_cell, status: "pending" })),
      { onConflict: "from_cell,to_cell", ignoreDuplicates: true },
    )
    .select("from_cell, to_cell");
  const mine = new Set((claimed ?? []).map((c) => `${c.from_cell}|${c.to_cell}`));
  const todo = list.filter((n) => mine.has(`${n.from_cell}|${n.to_cell}`));
  const mark = (n: Need, row: { status: string; minutes?: number | null }) =>
    admin
      .from("transit_legs")
      .update({ minutes: null, ...row, fetched_at: new Date().toISOString() })
      .eq("from_cell", n.from_cell)
      .eq("to_cell", n.to_cell);
  let done = 0;
  let stopped = false;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async (n) => {
        if (stopped) return mark(n, { status: "error" });
        const ok = await admin.rpc("claim_api_calls", { p_api: "kakao_transit", p_n: 1, p_cap: DAILY_CAP });
        // 오늘 몫을 다 씀 — 표시를 지워 내일 다시
        if (!ok.data) return admin.from("transit_legs").delete().eq("from_cell", n.from_cell).eq("to_cell", n.to_cell);
        const r = await fetchTransit(n, key);
        if (r === "stop") stopped = true;
        if (r === "stop" || r === "error") return mark(n, { status: "error" });
        done += 1;
        return mark(n, { status: r.status, minutes: r.status === "ok" ? r.minutes : null });
      }),
    );
  }
  return done;
}
