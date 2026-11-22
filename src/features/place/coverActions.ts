"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaceCovers } from "./covers";

// 지도 아래 카드처럼 화면에서 바뀌는 곳의 대표 사진 — 내 사진 · 팔로잉만 (place_covers 규칙 그대로)
export async function loadPlaceCovers(placeIds: string[]): Promise<Record<string, string>> {
  const ids = z.array(z.uuid()).max(30).safeParse(placeIds);
  if (!ids.success || ids.data.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const covers = await getPlaceCovers(supabase, ids.data);
  return Object.fromEntries([...covers].map(([id, c]) => [id, c.url]));
}
