"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TIERS, type Tier } from "@/domain/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { notifyVisitTag } from "@/features/visit/notify";
import { MAX_COMPANIONS, syncMyVisit } from "@/features/visit/visit";
import {
  RATING_VISIBILITIES,
  countUnrated,
  nextUnrated,
  RatingSchema,
  updateUserPlace,
  UserPlaceNotFoundError,
  type SavedPlace,
  type UnratedCursor,
} from "./rating";

export type RatingFormState = { error?: string; saved?: boolean };

const SAVE_FAILED = "저장하지 못했어요. 다시 시도해 주세요.";
const VISITED_TIERS: Tier[] = ["three", "two", "one", "notRecommended"];
const RATED_DB_TIERS = ["three", "two", "one", "not_recommended"];

const CompanionsField = z.object({
  userIds: z.array(z.uuid()).max(MAX_COMPANIONS),
  guests: z.array(z.string().trim().min(1).max(20)).max(MAX_COMPANIONS),
  showInFeed: z.boolean(),
});

function parseCompanions(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw) return null;
  try {
    return CompanionsField.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}
const NOT_SAVED = "저장한 장소가 아니에요.";

export async function saveRating(_prev: RatingFormState, formData: FormData): Promise<RatingFormState> {
  const parsed = RatingSchema.safeParse({
    placeId: formData.get("placeId"),
    tier: formData.get("tier"),
    note: String(formData.get("note") ?? ""),
    visitedOn: formData.get("visitedOn") || null,
    sponsored: formData.get("sponsored") === "on",
    review: String(formData.get("review") ?? ""),
    visibility: formData.get("visibility") ?? "private",
    menus: formData.getAll("menus").map(String).filter(Boolean),
  });
  if (!parsed.success) {
    const tierMissing = parsed.error.issues.some((i) => i.path[0] === "tier");
    return { error: tierMissing ? "등급을 골라 주세요." : (parsed.error.issues[0]?.message ?? SAVE_FAILED) };
  }

  const { supabase, userId } = await requireUser();
  const { placeId, ...rating } = parsed.data;
  const result = await runUpdate(() => updateUserPlace(supabase, userId, placeId, rating));
  if (result) return { error: result };

  // 함께 간 사람 — 다녀온 등급일 때만 맞춘다. 남이 만든 방문은 '피드에 보이기'만
  const companions = parseCompanions(formData.get("companions"));
  if (companions && VISITED_TIERS.includes(rating.tier)) {
    try {
      const { invited } = await syncMyVisit(supabase, userId, placeId, rating.visitedOn, companions);
      if (invited.length) after(() => notifyVisitTag(userId, invited));
    } catch {
      return { error: "평가는 저장했지만 함께 간 사람을 저장하지 못했어요. 다시 시도해 주세요." };
    }
  }
  const shown = new Set(formData.getAll("visitFeedOn").map(String));
  for (const visitId of formData.getAll("visitFeedIds").map(String).filter((id) => z.uuid().safeParse(id).success)) {
    await supabase.rpc("set_visit_feed", { p_visit: visitId, p_show: shown.has(visitId) });
  }
  // 돌아갈 화면이 새 평가를 보이게 — 이동은 화면이 뒤로가기로 한다
  revalidatePath("/", "layout");
  return { saved: true };
}

const TierInput = z.object({ placeId: z.uuid(), tier: z.enum(TIERS) });

// 빠르게 평가하기 — 등급만 바꾼다 (되돌리기는 unrated 로)
export async function setTier(placeId: string, tier: Tier): Promise<{ error?: string }> {
  const parsed = TierInput.safeParse({ placeId, tier });
  if (!parsed.success) return { error: SAVE_FAILED };
  const { supabase, userId } = await requireUser();
  const error = await runUpdate(() => updateUserPlace(supabase, userId, parsed.data.placeId, { tier: parsed.data.tier }));
  if (error) return { error };
  // 돌아간 홈 · 리스트의 평가 전 · 등급 숫자가 낡지 않게
  revalidatePath("/", "layout");
  return {};
}

const Cursor = z.object({ savedAt: z.iso.datetime({ offset: true }), placeId: z.uuid() }).nullable();

export async function loadNextUnrated(after: UnratedCursor | null): Promise<{ place: (SavedPlace & { cursor: UnratedCursor }) | null; remaining: number }> {
  const cursor = Cursor.parse(after);
  const { supabase, userId } = await requireUser();
  const [place, remaining] = await Promise.all([nextUnrated(supabase, userId, cursor), countUnrated(supabase, userId)]);
  return { place, remaining };
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  return { supabase, userId };
}

async function runUpdate(update: () => Promise<void>): Promise<string | null> {
  try {
    await update();
    return null;
  } catch (error) {
    return error instanceof UserPlaceNotFoundError ? NOT_SAVED : SAVE_FAILED;
  }
}

// 평가 삭제 (67-2) — 등급 · 한 줄 평가 · 먹은 메뉴 · 사진을 지우고 내 장소에는 평가 전으로 남긴다 (메모 · 리스트는 그대로)
export async function clearRating(placeId: string): Promise<{ error?: string }> {
  if (!z.uuid().safeParse(placeId).success) return { error: SAVE_FAILED };
  const { supabase, userId } = await requireUser();
  // 평가 먼저 지우고 사진 — 중간에 실패해도 '사진만 사라진 평가'가 남지 않게
  const result = await runUpdate(() => updateUserPlace(supabase, userId, placeId, { tier: "unrated", review: "", menus: [], sponsored: false }));
  if (result) return { error: result };
  const { data: media, error: listError } = await supabase.from("rating_media").select("id, path").eq("user_id", userId).eq("place_id", placeId);
  const rows = (media ?? []) as { id: string; path: string }[];
  if (listError) console.warn("[rating] 사진 목록 실패: code=%s", listError.code);
  if (rows.length) {
    const del = await supabase.from("rating_media").delete().in("id", rows.map((m) => m.id));
    if (del.error) console.warn("[rating] 사진 행 삭제 실패: code=%s", del.error.code);
    else {
      const files = await supabase.storage.from("rating-media").remove(rows.map((m) => m.path));
      if (files.error) console.warn("[rating] 사진 파일 삭제 실패");
    }
  }
  revalidatePath("/", "layout");
  return {};
}

// 내 평가 공개 범위 한 번에 바꾸기 (68) — 다녀온 등급(3 · 2 · 1숟가락 · 추천 안 함)만. 메모는 언제나 나만
export async function setAllRatingVisibility(visibility: string): Promise<{ error?: string; changed?: number }> {
  const parsed = z.enum(RATING_VISIBILITIES).safeParse(visibility);
  if (!parsed.success) return { error: SAVE_FAILED };
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase
    .from("user_places")
    .update({ visibility: parsed.data, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("tier", RATED_DB_TIERS)
    .neq("visibility", parsed.data)
    .select("place_id");
  if (error) return { error: SAVE_FAILED };
  revalidatePath("/", "layout");
  return { changed: data.length };
}
