import type { SupabaseClient } from "@supabase/supabase-js";

// 나와 서로 차단 사이인 사람들 — 사람 검색 · 초대 후보에서 뺀다
export async function getBlockedIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data } = await supabase.rpc("my_block_ids");
  return new Set(((data ?? []) as string[]).map(String));
}

export type BlockedPerson = { id: string; nickname: string; blockedAt: string };

// 내가 차단한 사람 (설정 화면)
export async function getMyBlocks(supabase: SupabaseClient, me: string): Promise<BlockedPerson[]> {
  const { data } = await supabase.from("blocks").select("blocked_id, created_at, profiles!blocks_blocked_id_fkey(nickname)").eq("blocker_id", me).order("created_at", { ascending: false });
  return ((data ?? []) as unknown as { blocked_id: string; created_at: string; profiles: { nickname: string } | null }[]).map((r) => ({
    id: r.blocked_id,
    nickname: r.profiles?.nickname ?? "",
    blockedAt: r.created_at,
  }));
}
