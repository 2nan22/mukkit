import { createClient } from "@supabase/supabase-js";
import { readPublicEnv } from "@/config/env";

// 세션 없이 공개 통로만 읽는 클라이언트 — 미리보기 이미지처럼 쿠키가 없는 곳에서 쓴다
export function createSupabaseAnonClient() {
  const env = readPublicEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });
}
