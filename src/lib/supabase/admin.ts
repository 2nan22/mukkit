import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 서비스 키 클라이언트 — RLS 를 건너뛴다. 서버 크론 · 공용 장소 행 만들기(upsertPlaces) · 약속 코스 길 · 대중교통 구간 저장(서버가 받은 값만)에서만, 그 밖의 사용자 요청 처리에 쓰지 않는다
export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
