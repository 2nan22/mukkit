import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import { runId } from "@/test/localSupabase";
import { JOB_NAME, runClosureCheck } from "./runClosureCheck";

// 로컬 Supabase 에 서비스 키로 실제로 써 본다 — `pnpm test:local-db`
const url = process.env.SUPABASE_TEST_URL;
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
const admin = url && secret ? createClient(url, secret, { auth: { persistSession: false } }) : null;

describe.skipIf(!admin)("runClosureCheck", () => {
  const sids = { open: `cl-open-${runId}`, closed: `cl-closed-${runId}`, unknown: `cl-unknown-${runId}` };
  const placeIds: string[] = [];

  afterAll(async () => {
    if (placeIds.length) await admin!.from("places").delete().in("id", placeIds);
  });

  it("판정대로 폐업 · 영업을 갱신하고 실행 기록을 남긴다", async () => {
    const old = new Date("2000-01-01").toISOString();
    for (const [i, sid] of Object.values(sids).entries()) {
      const { data } = await admin!
        .from("places")
        .insert({ source: "kakao", source_place_id: sid, name: `폐업검사${i}`, lat: 33.3 + i / 1000, lng: 126.3, cuisine: "korean", available: sid !== sids.open, source_checked_at: old })
        .select("id")
        .single();
      placeIds.push(data!.id as string);
      await admin!.from("place_sources").insert({ source: "kakao", source_place_id: sid, place_id: data!.id });
    }

    const result = await runClosureCheck(admin!, {
      // 오래된 순으로 고른 목록 중 이번 검사용 장소만 판정
      kakao: async (ids) => {
        const results = new Map<string, boolean>();
        if (ids.includes(sids.open)) results.set(sids.open, false);
        if (ids.includes(sids.closed)) results.set(sids.closed, true);
        return { results, unknown: ids.includes(sids.unknown) ? 1 : 0 };
      },
      naver: async () => ({ results: new Map(), failedLists: 0 }),
    });

    expect(result.ok).toBe(true);
    const { data: rows } = await admin!.from("places").select("source_place_id, available, source_checked_at").in("id", placeIds);
    const by = new Map(rows!.map((r) => [r.source_place_id as string, r]));
    expect(by.get(sids.open)!.available).toBe(false);
    expect(by.get(sids.closed)!.available).toBe(true);
    // 모름은 상태는 그대로, 확인 시각만 갱신
    expect(by.get(sids.unknown)!.available).toBe(true);
    expect(by.get(sids.unknown)!.source_checked_at).not.toBe(old);

    const { data: run } = await admin!.from("job_runs").select("ok, finished_at").eq("job", JOB_NAME).order("started_at", { ascending: false }).limit(1).single();
    expect(run!.ok).toBe(true);
    expect(run!.finished_at).not.toBeNull();
  });

  it("사용자 키로는 실행 기록을 읽을 수 없다", async () => {
    const anon = createClient(url!, process.env.SUPABASE_TEST_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { data } = await anon.from("job_runs").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
