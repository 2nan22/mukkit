import { timingSafeEqual } from "node:crypto";
import { runImportRefresh } from "@/features/import/runImportRefresh";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 매일 새벽 Vercel Cron — 가져온 네이버 · 카카오 리스트를 원본과 맞춘다. Authorization: Bearer <CRON_SECRET> 일 때만
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request.headers.get("authorization"))) return new Response("Unauthorized", { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return Response.json({ ok: false, error: "서비스 키 없음" }, { status: 500 });
  const result = await runImportRefresh(admin);
  console.info("[cron import-refresh]", JSON.stringify(result));
  return Response.json(result, { status: result.ok ? 200 : 500 });
}

function authorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
