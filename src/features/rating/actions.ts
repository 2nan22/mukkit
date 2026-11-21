"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TIERS, type Tier } from "@/domain/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import {
  countUnrated,
  nextUnrated,
  RatingSchema,
  updateUserPlace,
  UserPlaceNotFoundError,
  type SavedPlace,
} from "./rating";

export type RatingFormState = { error?: string; saved?: boolean };

const SAVE_FAILED = "저장하지 못했어요. 다시 시도해 주세요.";
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
  });
  if (!parsed.success) {
    const tierMissing = parsed.error.issues.some((i) => i.path[0] === "tier");
    return { error: tierMissing ? "등급을 골라 주세요." : (parsed.error.issues[0]?.message ?? SAVE_FAILED) };
  }

  const { supabase, userId } = await requireUser();
  const { placeId, ...rating } = parsed.data;
  const result = await runUpdate(() => updateUserPlace(supabase, userId, placeId, rating));
  if (result) return { error: result };
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
  return error ? { error } : {};
}

export async function loadNextUnrated(skipped: string[]): Promise<{ place: SavedPlace | null; remaining: number }> {
  const ids = z.array(z.uuid()).max(500).parse(skipped);
  const { supabase, userId } = await requireUser();
  const [place, remaining] = await Promise.all([nextUnrated(supabase, userId, ids), countUnrated(supabase, userId)]);
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
