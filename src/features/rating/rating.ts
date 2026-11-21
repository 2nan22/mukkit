import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TIERS, tierFromDb, tierToDb, type Tier } from "@/domain/tier";

export const NOTE_MAX = 300;
export const REVIEW_MAX = 200;
export const MENUS_MAX = 10;
export const MENU_NAME_MAX = 30;
export const RATING_VISIBILITIES = ["private", "followers", "public"] as const;
export type RatingVisibility = (typeof RATING_VISIBILITIES)[number];

export const RatingSchema = z.object({
  placeId: z.uuid(),
  tier: z.enum(TIERS),
  note: z.string().trim().max(NOTE_MAX, `한 줄 평가는 ${NOTE_MAX}자까지 쓸 수 있어요`),
  visitedOn: z.iso.date().nullable(),
  sponsored: z.boolean(),
  review: z.string().trim().max(REVIEW_MAX, `공개 한마디는 ${REVIEW_MAX}자까지 쓸 수 있어요`),
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
  visitedOn: string | null;
  sponsored: boolean;
  review: string;
  visibility: RatingVisibility;
  menus: string[];
};

const SAVED_PLACE_COLUMNS = "place_id, tier, note, visited_on, sponsored, review, visibility, menus, places(name, address, category_name, cuisine)";

type SavedPlaceRow = {
  place_id: string;
  tier: string;
  note: string;
  visited_on: string | null;
  sponsored: boolean;
  review: string;
  visibility: RatingVisibility;
  menus: string[] | null;
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
    visitedOn: row.visited_on,
    sponsored: row.sponsored,
    review: row.review,
    visibility: row.visibility,
    menus: row.menus ?? [],
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

// 평가 전 중 가장 최근에 저장한 곳 하나 — 이번에 건너뛴 곳은 뺀다
export async function nextUnrated(
  supabase: SupabaseClient,
  userId: string,
  skipped: string[],
): Promise<SavedPlace | null> {
  let query = supabase
    .from("user_places")
    .select(SAVED_PLACE_COLUMNS)
    .eq("user_id", userId)
    .eq("tier", "unrated")
    .order("saved_at", { ascending: false })
    .limit(1);
  if (skipped.length > 0) query = query.not("place_id", "in", `(${skipped.join(",")})`);
  const { data, error } = await query.returns<SavedPlaceRow[]>();
  if (error) throw new RatingSaveError(error.code);
  return data[0] ? toSavedPlace(data[0]) : null;
}
