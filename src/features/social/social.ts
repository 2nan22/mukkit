import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { tierFromDb, type Tier } from "@/domain/tier";
import { getBlockedIds } from "@/features/safety/safety";

const MEDIA_BUCKET = "rating-media";
const SIGNED_SECONDS = 3600;

export type Person = { id: string; nickname: string };
export type MediaRef = { kind: "image" | "video"; url: string };
export type SharedRating = {
  ownerId: string;
  ownerNickname: string;
  placeId: string;
  placeName: string;
  address: string;
  cuisine: Cuisine;
  tier: Tier;
  review: string;
  // 공개로 켠 메모만 (68-4) — 끈 메모는 빈 값
  note: string;
  noteSource: string | null;
  alias: string;
  media: MediaRef[];
  // 등급을 매긴 때 — 사진 · 글을 고쳐도 그대로 (82) · 방문일은 평가 화면에서 고른 날
  ratedAt: string;
  visitedOn: string | null;
  // 함께 간 사람 — 평가를 볼 수 있는 사람만 (피드는 둘 다 '피드에 보이기'를 허용했을 때만)
  companions: (Person & { isMe?: boolean })[];
  // 먹은 메뉴 (선택)
  menus: string[];
};

export class SocialError extends Error {
  constructor(readonly step: string, readonly code?: string) {
    super(`팔로우 처리 실패: ${step}`);
    this.name = "SocialError";
  }
}

export async function follow(supabase: SupabaseClient, me: string, target: string): Promise<void> {
  if (me === target) return;
  const { error } = await supabase.from("follows").upsert({ follower_id: me, followee_id: target }, { ignoreDuplicates: true });
  if (error) throw new SocialError("follow", error.code);
}

export async function unfollow(supabase: SupabaseClient, me: string, target: string): Promise<void> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", me).eq("followee_id", target);
  if (error) throw new SocialError("unfollow", error.code);
}

export async function getPerson(supabase: SupabaseClient, id: string): Promise<Person | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await supabase.from("profiles").select("id, nickname").eq("id", id).maybeSingle();
  return data ? { id: data.id as string, nickname: data.nickname as string } : null;
}

export async function getFollowCounts(supabase: SupabaseClient, id: string): Promise<{ followers: number; following: number }> {
  const [a, b] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", id),
    supabase.from("follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", id),
  ]);
  return { followers: a.count ?? 0, following: b.count ?? 0 };
}

export async function isFollowing(supabase: SupabaseClient, me: string, target: string): Promise<boolean> {
  const { data } = await supabase.from("follows").select("followee_id").eq("follower_id", me).eq("followee_id", target).maybeSingle();
  return Boolean(data);
}

// 닉네임 일부로 찾기 — 닉네임 말고는 아무것도 돌려주지 않는다
export async function searchPeople(supabase: SupabaseClient, query: string, me: string | null): Promise<Person[]> {
  const q = query.trim().replace(/[%_,()]/g, "");
  if (q.length < 1) return [];
  let req = supabase.from("profiles").select("id, nickname").ilike("nickname", `%${q}%`).limit(30);
  if (me) req = req.neq("id", me);
  const [{ data, error }, blocked] = await Promise.all([req, me ? getBlockedIds(supabase) : Promise.resolve(new Set<string>())]);
  if (error) throw new SocialError("search", error.code);
  return data.filter((r) => !blocked.has(r.id as string)).map((r) => ({ id: r.id as string, nickname: r.nickname as string }));
}

type RatingRow = {
  owner_id?: string;
  owner_nickname?: string;
  place_id: string;
  place_name: string;
  address: string;
  cuisine: string;
  tier: string;
  review: string;
  note?: string | null;
  note_source?: string | null;
  alias?: string | null;
  media: { path: string; kind: "image" | "video" }[];
  rated_at: string;
  visited_on?: string | null;
  companions?: (Person & { isMe?: boolean })[];
  menus?: string[] | null;
};

// 사진 주소는 보는 사람 권한으로 서명한다 — 볼 수 없는 평가의 사진은 서명이 거절된다
async function withMedia(supabase: SupabaseClient, rows: RatingRow[], owner?: Person): Promise<SharedRating[]> {
  const paths = rows.flatMap((r) => r.media.map((m) => m.path));
  const signed = paths.length ? (await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(paths, SIGNED_SECONDS)).data ?? [] : [];
  const urlOf = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));
  return rows.map((r) => ({
    ownerId: r.owner_id ?? owner?.id ?? "",
    ownerNickname: r.owner_nickname ?? owner?.nickname ?? "",
    placeId: r.place_id,
    placeName: r.place_name,
    address: r.address,
    cuisine: r.cuisine as Cuisine,
    tier: tierFromDb(r.tier),
    review: r.review,
    note: r.note ?? "",
    noteSource: r.note_source ?? null,
    alias: r.alias ?? "",
    media: r.media.flatMap((m) => (urlOf.get(m.path) ? [{ kind: m.kind, url: urlOf.get(m.path)! }] : [])),
    ratedAt: r.rated_at,
    visitedOn: r.visited_on ?? null,
    companions: r.companions ?? [],
    menus: r.menus ?? [],
  }));
}

export async function getProfileRatings(supabase: SupabaseClient, owner: Person): Promise<SharedRating[]> {
  const { data, error } = await supabase.rpc("profile_ratings", { p_owner: owner.id });
  if (error) throw new SocialError("profile_ratings", error.code);
  return withMedia(supabase, data as RatingRow[], owner);
}

// 평가 하나 — 댓글 화면 머리. 볼 수 없으면 null
export async function getRatingDetail(supabase: SupabaseClient, ownerId: string, placeId: string): Promise<SharedRating | null> {
  const { data, error } = await supabase.rpc("rating_detail", { p_owner: ownerId, p_place: placeId });
  if (error) throw new SocialError("rating_detail", error.code);
  const rows = data as RatingRow[];
  return rows.length ? (await withMedia(supabase, rows))[0] : null;
}

// mine: 내 평가(전체 · 팔로워 공개)도 섞기 — 피드 탭만. 홈 '팔로잉 새 평가'는 팔로잉 것만 (68-9)
// after: 앞 쪽 마지막 카드 — 이어 받는 자리(시각 + 사람 + 장소, 70)
export type FeedCursor = { ratedAt: string; ownerId: string; placeId: string };
export const FEED_PAGE = 20;
export async function getFeed(supabase: SupabaseClient, { after, mine = false }: { after?: FeedCursor; mine?: boolean } = {}): Promise<SharedRating[]> {
  const { data, error } = await supabase.rpc("feed", {
    p_before: after?.ratedAt ?? null,
    p_limit: FEED_PAGE,
    p_mine: mine,
    p_before_owner: after?.ownerId ?? null,
    p_before_place: after?.placeId ?? null,
  });
  if (error) throw new SocialError("feed", error.code);
  return withMedia(supabase, data as RatingRow[]);
}

export type Taste = { overlap: number; bothThree: number; similarity: number };
export type TasteMatch = Taste & { userId: string; nickname: string; threeRatio: number };
export type ProfileStats = { three: number; two: number; one: number; notRecommended: number; sponsored: number };
export type ProfileList = { id: string; name: string; count: number };

export async function getTasteWith(supabase: SupabaseClient, other: string): Promise<Taste | null> {
  const { data, error } = await supabase.rpc("taste_with", { p_other: other });
  if (error || !data?.[0]) return null;
  const r = data[0] as { overlap: number; both_three: number; similarity: number | null };
  return { overlap: r.overlap, bothThree: r.both_three, similarity: Number(r.similarity ?? 0) };
}

export async function getTasteMatches(supabase: SupabaseClient, limit = 10): Promise<TasteMatch[]> {
  const { data, error } = await supabase.rpc("taste_matches", { p_limit: limit });
  if (error) throw new SocialError("taste_matches", error.code);
  return (data as { user_id: string; nickname: string; overlap: number; both_three: number; similarity: number; three_ratio: number }[]).map((r) => ({
    userId: r.user_id,
    nickname: r.nickname,
    overlap: r.overlap,
    bothThree: r.both_three,
    similarity: Number(r.similarity),
    threeRatio: r.three_ratio,
  }));
}

export async function getProfileStats(supabase: SupabaseClient, owner: string): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc("profile_stats", { p_owner: owner });
  if (error) throw new SocialError("profile_stats", error.code);
  const r = (data as { three: number; two: number; one: number; not_recommended: number; sponsored: number }[])[0];
  return { three: r.three, two: r.two, one: r.one, notRecommended: r.not_recommended, sponsored: r.sponsored };
}

export async function getProfileLists(supabase: SupabaseClient, owner: string): Promise<ProfileList[]> {
  const { data, error } = await supabase.rpc("profile_lists", { p_owner: owner });
  if (error) throw new SocialError("profile_lists", error.code);
  return (data as { id: string; name: string; count: number }[]).map((r) => ({ id: r.id, name: r.name, count: r.count }));
}

export async function getBio(supabase: SupabaseClient, id: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("bio").eq("id", id).maybeSingle();
  return (data?.bio as string | null) ?? "";
}

export type RecentList = { id: string; name: string; ownerNickname: string; count: number; points: { placeId: string; cuisine: Cuisine; lat: number; lng: number; tier: string | null }[]; saves?: number };

// 요즘 많이 저장된 공개 리스트 — 최근 30일 저장 수 › 전체 저장 수 › 최근 고친 순
export async function getPopularPublicLists(supabase: SupabaseClient, limit = 4, offset = 0): Promise<RecentList[]> {
  const { data, error } = await supabase.rpc("popular_public_lists", { p_limit: limit, p_offset: offset });
  if (error) throw new SocialError("popular_public_lists", error.code);
  return (data as { id: string; name: string; owner_nickname: string; count: number; points: RecentList["points"]; saves: number }[]).map((r) => ({
    id: r.id,
    name: r.name,
    ownerNickname: r.owner_nickname,
    count: r.count,
    points: r.points,
    saves: r.saves,
  }));
}
