"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { candidateQuery, type PlaceCandidate } from "@/domain/textPlaces";
import { tierFromDb, type Tier } from "@/domain/tier";
import type { Cuisine } from "@/domain/cuisine";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { TEXT_IMPORT_ENABLED } from "@/features/textImport/enabled";
import { searchKakaoKeywordOrFail } from "@/features/search/kakaoLocal";
import { knownKakaoPlaces } from "@/features/search/search";
import { openKakaoPlace } from "@/features/search/actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return { supabase, me };
}

export type FoundHit = { kakaoId: string; name: string; lat: number; lng: number; cuisine: Cuisine; meta: string[]; placeId: string | null; tier: Tier | null };
// failed: 카카오 검색이 오류로 실패 (0건과 구분)
export type CandidateResult = { candidate: PlaceCandidate; hits: FoundHit[]; failed: boolean };

const Candidates = z
  .array(z.object({ name: z.string().trim().min(2).max(30), address: z.string().max(80).nullable(), area: z.string().max(12).nullable().optional() }))
  .min(1)
  .max(8);

// 글에서 뽑은 후보마다 카카오에서 가게 3곳까지 — 이미 내 장소면 내 등급도
export async function findCandidatePlaces(candidates: PlaceCandidate[]): Promise<{ results: CandidateResult[]; error?: string }> {
  if (!TEXT_IMPORT_ENABLED) return { results: [], error: "지금은 쓸 수 없는 기능이에요." };
  const parsed = Candidates.safeParse(candidates);
  if (!parsed.success) return { results: [], error: "찾을 가게가 없어요." };
  const { supabase, me } = await requireUser();
  // 넉넉히 찾아 음식점 결과가 있으면 음식점만(주차장 등 제외), 3곳까지
  const raw = await Promise.all(parsed.data.map((c) => searchKakaoKeywordOrFail(candidateQuery(c), undefined, 6)));
  if (raw.every((l) => l === null)) return { results: [], error: "지금은 가게를 찾을 수 없어요. 잠시 뒤 다시 시도해 주세요." };
  const lists = raw.map((l) => {
    if (!Array.isArray(l)) return [];
    const food = l.filter((h) => h.cuisine !== "nonFood");
    return (food.length ? food : l).slice(0, 3);
  });
  const known = await knownKakaoPlaces(supabase, me, lists.flatMap((l) => l.map((h) => h.id)));
  const results = parsed.data.map((candidate, i) => ({
    candidate,
    failed: raw[i] === "failed",
    hits: lists[i].map((h) => ({
      kakaoId: h.id,
      name: h.name,
      lat: h.lat,
      lng: h.lng,
      cuisine: h.cuisine,
      meta: [h.categoryName, h.address].filter(Boolean),
      placeId: known.get(h.id)?.placeId ?? null,
      tier: known.get(h.id)?.tier ?? null,
    })),
  }));
  return { results };
}

const SaveInput = z.object({
  kakaoId: z.string().regex(/^\d{1,20}$/),
  name: z.string().min(1).max(100),
  lat: z.number(),
  lng: z.number(),
  sourceUrl: z.url({ protocol: /^https?$/ }).max(300).nullable(),
});

// 고른 가게를 가고 싶은 곳으로 — 장소는 카카오에 다시 확인해 만들고(브라우저 값 불신), 이미 저장한 곳은 그대로
// 원문 링크가 있으면 나만 보는 메모로
export async function saveFoundPlace(input: z.input<typeof SaveInput>): Promise<{ placeId?: string; tier?: Tier; error?: string }> {
  if (!TEXT_IMPORT_ENABLED) return { error: "지금은 쓸 수 없는 기능이에요." };
  const parsed = SaveInput.safeParse(input);
  if (!parsed.success) return { error: "저장하지 못했어요." };
  const { supabase, me } = await requireUser();
  const { sourceUrl, ...hit } = parsed.data;
  const opened = await openKakaoPlace(hit);
  if (!opened.placeId) return { error: opened.error ?? "저장하지 못했어요." };
  // 원문 링크는 나만 보는 메모 — 기본 공개 범위(87)를 따르지 않게 메모만 나만으로
  const { error } = await supabase
    .from("user_places")
    .upsert({ user_id: me, place_id: opened.placeId, tier: "want_to_go", note: sourceUrl ? `출처 ${sourceUrl}` : "", note_visibility: "private" }, { onConflict: "user_id,place_id", ignoreDuplicates: true });
  if (error) return { error: "저장하지 못했어요. 다시 시도해 주세요." };
  const row = await supabase.from("user_places").select("tier").eq("user_id", me).eq("place_id", opened.placeId).maybeSingle();
  revalidatePath("/map");
  return { placeId: opened.placeId, tier: row.data ? tierFromDb(row.data.tier as string) : "wantToGo" };
}
