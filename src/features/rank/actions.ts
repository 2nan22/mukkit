"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getThreeRanking, type RankPlace } from "./rank";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  return { supabase, userId };
}

// 비교 시작 — 이 곳을 뺀 순위 목록 · 이 곳이 이미 순위에 있는지
export async function loadThreeCompare(placeId: string): Promise<{ ranked: RankPlace[]; target: RankPlace | null; alreadyRanked: boolean }> {
  if (!z.uuid().safeParse(placeId).success) return { ranked: [], target: null, alreadyRanked: false };
  const { supabase, userId } = await requireUser();
  const { ranked, unranked } = await getThreeRanking(supabase, userId);
  const target = [...ranked, ...unranked].find((p) => p.placeId === placeId) ?? null;
  return { ranked: ranked.filter((p) => p.placeId !== placeId), target, alreadyRanked: ranked.some((p) => p.placeId === placeId) };
}

// afterPlaceId 바로 아래에 넣는다 (null 이면 1위) — 저장 시점의 순위를 다시 읽어 그 사이 바뀐 것도 반영
export async function placeInThree(placeId: string, afterPlaceId: string | null): Promise<{ error?: string; rank?: number }> {
  if (!z.uuid().safeParse(placeId).success || (afterPlaceId !== null && !z.uuid().safeParse(afterPlaceId).success)) return { error: "순위를 저장하지 못했어요." };
  const { supabase, userId } = await requireUser();
  const { ranked } = await getThreeRanking(supabase, userId);
  const order = ranked.map((p) => p.placeId).filter((id) => id !== placeId);
  const at = afterPlaceId === null ? 0 : order.indexOf(afterPlaceId) + 1;
  order.splice(at < 0 ? order.length : at, 0, placeId);
  const { error } = await supabase.rpc("set_three_order", { p_places: order });
  if (error) return { error: "순위를 저장하지 못했어요. 다시 시도해 주세요." };
  revalidatePath("/rank");
  return { rank: order.indexOf(placeId) + 1 };
}
