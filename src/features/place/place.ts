import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { tierFromDb, type Tier } from "@/domain/tier";
import type { MediaRef } from "@/features/social/social";

const MEDIA_BUCKET = "rating-media";

export type PlaceInfo = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  cuisine: Cuisine;
  categoryName: string;
  available: boolean;
  sources: { source: PlaceSourceName; sourcePlaceId: string }[];
};

export type OtherRating = {
  userId: string;
  nickname: string;
  followed: boolean;
  tier: Tier;
  review: string;
  // 공개로 켠 메모만 (68-4)
  note: string;
  noteSource: string | null;
  alias: string;
  visitedOn: string | null;
  sponsored: boolean;
  media: MediaRef[];
  ratedCount: number;
  threeRatio: number;
  companions: { id: string; nickname: string; isMe?: boolean }[];
  menus: string[];
};

export async function getPlace(supabase: SupabaseClient, id: string): Promise<PlaceInfo | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabase
    .from("places")
    .select("id, name, lat, lng, address, cuisine, category_name, available, place_sources(source, source_place_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    lat: data.lat as number,
    lng: data.lng as number,
    address: data.address as string,
    cuisine: data.cuisine as Cuisine,
    categoryName: data.category_name as string,
    available: data.available as boolean,
    sources: (data.place_sources as { source: string; source_place_id: string }[]).map((s) => ({
      source: s.source as PlaceSourceName,
      sourcePlaceId: s.source_place_id,
    })),
  };
}

// 원문 링크 — 출처 ID 가 있으면 그 장소로, 없으면 이름으로 검색
export function sourceLinks(p: PlaceInfo): { naver: string; kakao: string; directions: string } {
  const naver = p.sources.find((s) => s.source === "naver");
  const kakao = p.sources.find((s) => s.source === "kakao" && !s.sourcePlaceId.startsWith("N"));
  const q = encodeURIComponent(p.name);
  return {
    naver: naver ? `https://map.naver.com/p/entry/place/${naver.sourcePlaceId}` : `https://map.naver.com/p/search/${q}`,
    kakao: kakao ? `https://place.map.kakao.com/${kakao.sourcePlaceId}` : `https://map.kakao.com/?q=${q}`,
    directions: `https://map.kakao.com/link/to/${q},${p.lat},${p.lng}`,
  };
}

type Row = {
  user_id: string; nickname: string; followed: boolean; tier: string; review: string; note?: string | null; note_source?: string | null; alias?: string | null; visited_on: string | null;
  sponsored: boolean; media: { path: string; kind: "image" | "video" }[]; rated_count: number; three_ratio: number;
  companions: { id: string; nickname: string; isMe?: boolean }[];
  menus: string[] | null;
};

export async function getOtherRatings(supabase: SupabaseClient, placeId: string): Promise<OtherRating[]> {
  const { data, error } = await supabase.rpc("place_ratings", { p_place: placeId });
  if (error) throw new Error(`장소 평가 조회 실패: ${error.code}`);
  const rows = data as Row[];
  const paths = rows.flatMap((r) => r.media.map((m) => m.path));
  const signed = paths.length ? (await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlOf = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return rows.map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    followed: r.followed,
    tier: tierFromDb(r.tier),
    review: r.review,
    note: r.note ?? "",
    noteSource: r.note_source ?? null,
    alias: r.alias ?? "",
    visitedOn: r.visited_on,
    sponsored: r.sponsored,
    media: r.media.flatMap((m) => (urlOf.get(m.path) ? [{ kind: m.kind, url: urlOf.get(m.path)! }] : [])),
    ratedCount: r.rated_count,
    threeRatio: r.three_ratio,
    companions: r.companions ?? [],
    menus: r.menus ?? [],
  }));
}

export async function getMyMedia(supabase: SupabaseClient, me: string, placeId: string): Promise<MediaRef[]> {
  const { data } = await supabase.from("rating_media").select("path, kind").eq("user_id", me).eq("place_id", placeId).order("created_at");
  const rows = (data ?? []) as { path: string; kind: "image" | "video" }[];
  if (rows.length === 0) return [];
  const signed = (await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(rows.map((r) => r.path), 3600)).data ?? [];
  return rows.flatMap((r, i) => (signed[i]?.signedUrl ? [{ kind: r.kind, url: signed[i].signedUrl }] : []));
}
