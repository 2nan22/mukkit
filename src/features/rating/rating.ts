import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TIERS, tierFromDb, tierToDb, type Tier } from "@/domain/tier";

export const NOTE_MAX = 300;
export const REVIEW_MAX = 200;
export const MENUS_MAX = 10;
export const MENU_NAME_MAX = 30;
export const RATING_VISIBILITIES = ["private", "followers", "public"] as const;
export type RatingVisibility = (typeof RATING_VISIBILITIES)[number];
// 메모 공개 범위 (68-5) — 기본 평가와 같게(DB null) · 평가보다 넓어지지는 않는다(평가를 볼 수 있는 사람 중에서만)
export const NOTE_VISIBILITIES = ["same", ...RATING_VISIBILITIES] as const;
export type NoteVisibility = (typeof NOTE_VISIBILITIES)[number];
export const noteVisibilityToDb = (v: NoteVisibility): RatingVisibility | null => (v === "same" ? null : v);
export const noteVisibilityFromDb = (v: string | null): NoteVisibility => ((RATING_VISIBILITIES as readonly string[]).includes(v ?? "") ? (v as RatingVisibility) : "same");
// 다녀온 등급(DB 값) — 공개 범위가 뜻을 갖는 등급 (68)
export const RATED_DB_TIERS = ["three", "two", "one", "not_recommended"];

export const RatingSchema = z.object({
  placeId: z.uuid(),
  tier: z.enum(TIERS),
  note: z.string().trim().max(NOTE_MAX, `메모는 ${NOTE_MAX}자까지 쓸 수 있어요`),
  noteVisibility: z.enum(NOTE_VISIBILITIES),
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
  noteVisibility?: NoteVisibility;
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
  if (patch.noteVisibility !== undefined) row.note_visibility = noteVisibilityToDb(patch.noteVisibility);
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
  // 메모 공개 범위 (68-5) — 기본 평가와 같게
  noteVisibility: NoteVisibility;
  // 지도 앱 원본 메모 그대로면 그 앱 (68-6)
  noteSource: string | null;
  // 지도 앱 별명 (68-7)
  alias: string;
  visitedOn: string | null;
  sponsored: boolean;
  review: string;
  visibility: RatingVisibility;
  menus: string[];
  // 3숟가락 안 순위 (1부터) · 안 정했으면 null
  rank?: number | null;
};

const SAVED_PLACE_COLUMNS = "place_id, tier, note, note_visibility, note_source, place_alias, visited_on, sponsored, review, visibility, menus, tier_rank, places(name, address, category_name, cuisine)";

type SavedPlaceRow = {
  place_id: string;
  tier: string;
  note: string;
  note_visibility: RatingVisibility | null;
  note_source: string | null;
  place_alias: string | null;
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
    noteVisibility: noteVisibilityFromDb(row.note_visibility),
    noteSource: row.note_source,
    alias: row.place_alias ?? "",
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
