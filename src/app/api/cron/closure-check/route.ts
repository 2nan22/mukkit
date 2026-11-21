import { timingSafeEqual } from "node:crypto";
import { runClosureCheck } from "@/features/closure/runClosureCheck";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 매일 새벽 Vercel Cron 이 부른다 — Authorization: Bearer <CRON_SECRET> 일 때만
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ ok: false, error: "서비스 키 없음" }, { status: 500 });
  const result = await runClosureCheck(admin);
  console.info("[cron closure-check]", JSON.stringify({ ok: result.ok, checked: result.checked, closed: result.closed, reopened: result.reopened, detail: result.detail, error: result.error }));
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
