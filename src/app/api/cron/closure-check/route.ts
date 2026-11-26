import { isCronAuthorized } from "@/lib/cron/authorized";
import { runClosureCheck } from "@/features/closure/runClosureCheck";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 매일 새벽 Vercel Cron 이 부른다 — Authorization: Bearer <CRON_SECRET> 일 때만
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ ok: false, error: "서비스 키 없음" }, { status: 500 });
  const result = await runClosureCheck(admin);
  // 끝났거나 지난 약속의 위치 기록 정리 — 같은 새벽 작업에 붙인다
  const cleaned = await admin.rpc("cleanup_meetup_points");
  // 90일 지난 알림 정리
  const oldNotes = await admin.rpc("cleanup_notifications");
  // 30일 지난 대중교통 구간 · 90일 지난 호출 수 정리 (86, 처리방침 제11조)
  const oldLegs = await admin.from("transit_legs").delete({ count: "exact" }).lt("fetched_at", new Date(Date.now() - 30 * 86_400_000).toISOString());
  await admin.from("api_usage").delete().lt("day", new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10));
  console.info("[cron transit-cleanup]", JSON.stringify({ deleted: oldLegs.count ?? null, error: oldLegs.error?.code ?? null }));
  console.info("[cron notifications-cleanup]", JSON.stringify({ deleted: oldNotes.data ?? null, error: oldNotes.error?.code ?? null }));
  console.info("[cron meetup-cleanup]", JSON.stringify({ deleted: cleaned.data ?? null, error: cleaned.error?.code ?? null }));
  console.info("[cron closure-check]", JSON.stringify({ ok: result.ok, checked: result.checked, closed: result.closed, reopened: result.reopened, detail: result.detail, error: result.error }));
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
