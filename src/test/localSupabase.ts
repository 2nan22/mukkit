import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// 로컬 Supabase 에 실제로 쓰는 검사용 — `pnpm test:local-db` 가 주소 · 키를 넣어 준다
export const localUrl = process.env.SUPABASE_TEST_URL;
export const localKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
export const hasLocalDb = Boolean(localUrl && localKey);

export const runId = Math.random().toString(36).slice(2, 10);

export async function signUpTestUser(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createClient(localUrl!, localKey!, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.signUp({
    email: `test-${runId}-${Math.random().toString(36).slice(2, 6)}@test.local`,
    password: `pw-${runId}-long-enough`,
  });
  if (error || !data.user) throw error ?? new Error("가입 실패");
  return { supabase, userId: data.user.id };
}
