import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileFlags = { nickname_set_at: string | null; terms_version: string | null; push_off: string[] };

// 가입 단계 · 알림 설정 — profiles 의 이 칸들은 공개 읽기에서 빠져 있어 본인 함수로만 읽는다
export async function getMyProfileFlags(supabase: SupabaseClient): Promise<ProfileFlags | null> {
  const { data, error } = await supabase.rpc("my_profile_flags").maybeSingle<ProfileFlags>();
  if (error) throw new Error(`프로필 상태 조회 실패: ${error.code}`);
  return data ?? null;
}
