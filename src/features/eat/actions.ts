"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { groupRecommendations, type CuisineGroup } from "@/domain/eatScore";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getEatCandidates, getMyTasteBasis } from "./eat";

const Input = z.object({ lat: z.number().min(33).max(39), lng: z.number().min(124).max(132), radius: z.union([z.literal(500), z.literal(1000), z.literal(3000)]) });

export async function findEats(lat: number, lng: number, radius: number): Promise<{ groups?: CuisineGroup[]; error?: string }> {
  const parsed = Input.safeParse({ lat, lng, radius });
  if (!parsed.success) return { error: "국내 위치에서만 추천할 수 있어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  try {
    const [candidates, basis] = await Promise.all([getEatCandidates(supabase, lat, lng, radius), getMyTasteBasis(supabase, me)]);
    return { groups: groupRecommendations(candidates, { lat, lng }, radius, basis.pref) };
  } catch {
    return { error: "추천을 불러오지 못했어요. 다시 시도해 주세요." };
  }
}
