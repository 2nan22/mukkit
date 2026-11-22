import type { SupabaseClient } from "@supabase/supabase-js";

const MEDIA_BUCKET = "rating-media";
const SIGNED_SECONDS = 3600;

export type PlaceCover = { url: string; ownerNickname: string; mine: boolean };

// 장소 대표 사진 — 사용자가 올린 평가 사진 중 하나 (내 사진 › 팔로잉 › 볼 수 있는 공개 평가)
// 서명은 보는 사람 권한으로 — 볼 수 없는 사진은 서명이 거절된다
export async function getPlaceCovers(supabase: SupabaseClient, placeIds: string[]): Promise<Map<string, PlaceCover>> {
  const ids = [...new Set(placeIds)].slice(0, 300);
  const out = new Map<string, PlaceCover>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase.rpc("place_covers", { p_places: ids });
  if (error || !data?.length) return out;
  const rows = data as { place_id: string; path: string; owner_nickname: string; mine: boolean }[];
  const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(rows.map((r) => r.path), SIGNED_SECONDS);
  const urlOf = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  for (const r of rows) {
    const url = urlOf.get(r.path);
    if (url) out.set(r.place_id, { url, ownerNickname: r.owner_nickname, mine: r.mine });
  }
  return out;
}
