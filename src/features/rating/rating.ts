import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TIERS, tierFromDb, tierToDb, type Tier } from "@/domain/tier";

export const NOTE_MAX = 300;
export const REVIEW_MAX = 200;
export const MENUS_MAX = 10;
export const MENU_NAME_MAX = 30;
export const RATING_VISIBILITIES = ["private", "followers", "public"] as const;
export type RatingVisibility = (typeof RATING_VISIBILITIES)[number];
// 다녀온 등급(DB 값) — 공개 범위가 뜻을 갖는 등급 (68)
export const RATED_DB_TIERS = ["three", "two", "one", "not_recommended"];

export const RatingSchema = z.object({
  placeId: z.uuid(),
  tier: z.enum(TIERS),
  note: z.string().trim().max(NOTE_MAX, `메모는 ${NOTE_MAX}자까지 쓸 수 있어요`),
  // 스위치를 건드렸을 때만 — 안 건드리면 정하지 않음 그대로 (한 번에 공개 대상으로 남게)
  notePublic: z.boolean().optional(),
  visitedOn: z.iso.date().nullable(),
  sponsored: z.boolean(),
  review: z.string().trim().max(REVIEW_MAX, `한 줄 평가는 ${REVIEW_MAX}자까지 쓸 수 있어요`),
  visibility: z.enum(RATING_VISIBILITIES),
  menus: z.array(z.string().trim().min(1).max(MENU_NAME_MAX)).max(MENUS_MAX),
});
export type Rating = z.infer<typeof RatingSchema>;

export class UserPlaceNotFoundError extends Error {
  constructor() {
    super("저장한 장소가 아닙니다");
    this.name = "UserPlaceNotFoundError";
  }
}

export class RatingSaveError extends Error {
  constructor(readonly code?: string) {
    super("평가 저장 실패");
    this.name = "RatingSaveError";
  }
}

type Patch = {
  tier?: Tier;
  note?: string;
  notePublic?: boolean;
  visitedOn?: string | null;
  sponsored?: boolean;
  review?: string;
  visibility?: RatingVisibility;
  menus?: string[];
};

// 내 저장 한 줄만 고친다 — 남의 줄은 RLS 가 막고, 맞는 줄이 없으면 오류
export async function updateUserPlace(
  supabase: SupabaseClient,
  userId: string,
  placeId: string,
  patch: Patch,
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.tier) row.tier = tierToDb(patch.tier);
  if (patch.note !== undefined) row.note = patch.note;
  // 직접 켜고 끈 것만 적는다 — 빈 메모는 DB 트리거가 공개에서 뺀다 (68-4)
  if (patch.notePublic !== undefined) row.note_public = patch.notePublic;
  if (patch.visitedOn !== undefined) row.visited_on = patch.visitedOn;
  if (patch.sponsored !== undefined) row.sponsored = patch.sponsored;
  if (patch.review !== undefined) row.review = patch.review;
  if (patch.visibility !== undefined) row.visibility = patch.visibility;
  if (patch.menus !== undefined) row.menus = [...new Set(patch.menus)];

  const { data, error } = await supabase
    .from("user_places")
    .update(row)
    .eq("user_id", userId)
    .eq("place_id", placeId)
    .select("place_id");
  if (error) throw new RatingSaveError(error.code);
  if (data.length === 0) throw new UserPlaceNotFoundError();
}

export type SavedPlace = {
  placeId: string;
  name: string;
  address: string;
  categoryName: string;
  cuisine: string;
  tier: Tier;
  note: string;
  // 메모를 평가 공개 범위대로 보여 줄지 (68-4) — 기본 나만
  notePublic: boolean;
  visitedOn: string | null;
  sponsored: boolean;
  review: string;
  visibility: RatingVisibility;
  menus: string[];
  // 3숟가락 안 순위 (1부터) · 안 정했으면 null
  rank?: number | null;
};

const SAVED_PLACE_COLUMNS = "place_id, tier, note, note_public, visited_on, sponsored, review, visibility, menus, tier_rank, places(name, address, category_name, cuisine)";

type SavedPlaceRow = {
  place_id: string;
  tier: string;
  note: string;
  // null 정하지 않음 · false 직접 끔 (68-4)
  note_public: boolean | null;
  visited_on: string | null;
  sponsored: boolean;
  review: string;
  visibility: RatingVisibility;
  menus: string[] | null;
  tier_rank: number | null;
  places: { name: string; address: string; category_name: string; cuisine: string } | null;
};

function toSavedPlace(row: SavedPlaceRow): SavedPlace {
  return {
    placeId: row.place_id,
    name: row.places?.name ?? "",
    address: row.places?.address ?? "",
    categoryName: row.places?.category_name ?? "",
    cuisine: row.places?.cuisine ?? "other",
    tier: tierFromDb(row.tier),
    note: row.note,
    notePublic: row.note_public === true,
    visitedOn: row.visited_on,
    sponsored: row.sponsored,
    review: row.review,
    visibility: row.visibility,
    menus: row.menus ?? [],
    rank: row.tier_rank === null ? null : row.tier_rank + 1,
  };
}

export async function getSavedPlace(supabase: SupabaseClient, userId: string, placeId: string): Promise<SavedPlace | null> {
  const { data, error } = await supabase
    .from("user_places")
    .select(SAVED_PLACE_COLUMNS)
    .eq("user_id", userId)
    .eq("place_id", placeId)
    .maybeSingle<SavedPlaceRow>();
  if (error) throw new RatingSaveError(error.code);
  return data ? toSavedPlace(data) : null;
}

export async function countUnrated(supabase: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_places")
    .select("place_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("tier", "unrated");
  if (error) throw new RatingSaveError(error.code);
  return count ?? 0;
}

export type UnratedCursor = { savedAt: string; placeId: string };

// 평가 전 중 가장 최근에 저장한 곳 하나 — 건너뛴 곳은 그 자리(커서) 다음부터 (건너뛴 id 를 모두 실으면 주소가 길어져 실패)
export async function nextUnrated(
  supabase: SupabaseClient,
  userId: string,
  after: UnratedCursor | null,
): Promise<(SavedPlace & { cursor: UnratedCursor }) | null> {
  let query = supabase
    .from("user_places")
    .select(`${SAVED_PLACE_COLUMNS}, saved_at`)
    .eq("user_id", userId)
    .eq("tier", "unrated")
    .order("saved_at", { ascending: false })
    .order("place_id")
    .limit(1);
  if (after) query = query.or(`saved_at.lt."${after.savedAt}",and(saved_at.eq."${after.savedAt}",place_id.gt.${after.placeId})`);
  const { data, error } = await query.returns<(SavedPlaceRow & { saved_at: string })[]>();
  if (error) throw new RatingSaveError(error.code);
  const row = data[0];
  return row ? { ...toSavedPlace(row), cursor: { savedAt: row.saved_at, placeId: row.place_id } } : null;
}
