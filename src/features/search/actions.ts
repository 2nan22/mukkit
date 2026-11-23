"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { Cuisine } from "@/domain/cuisine";
import { distanceMeters, isSamePlace, normalizePlaceName } from "@/domain/samePlace";
import type { Tier } from "@/domain/tier";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { upsertPlaces } from "@/features/import/saveImportedList";
import { searchPeople, type Person } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hitToImportedPlace, searchKakaoKeyword } from "./kakaoLocal";
import { cleanQuery, knownKakaoPlaces, searchMyPlaces, type MyPlaceHit } from "./search";

export type NewPlaceHit = {
  kakaoId: string;
  name: string;
  lat: number;
  lng: number;
  cuisine: Cuisine;
  meta: string;
  // 이미 마이슐랭에 있는 장소면 바로 상세로
  placeId: string | null;
  tier: Tier | null;
};
export type SearchResult = { mine: MyPlaceHit[]; places: NewPlaceHit[]; people: Person[]; placeSearch: boolean };

const Near = z.object({ lat: z.number().min(33).max(39), lng: z.number().min(124).max(132) }).nullable();

function km(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

// dedupeMine: 다른 출처로 저장한 내 장소와 같은 가게를 카카오 결과에서 뺄지 (/search 전용 — 지도는 위쪽 목록이 내 장소가 아닐 수 있다)
export async function searchAll(query: string, near: { lat: number; lng: number } | null, dedupeMine = true): Promise<SearchResult> {
  const q = cleanQuery(query);
  const empty = { mine: [], places: [], people: [], placeSearch: true };
  if (q.length < 1) return empty;
  const at = Near.safeParse(near).success ? near : null;
  const { supabase, me } = await requireUser();

  const [mine, hits, people] = await Promise.all([
    searchMyPlaces(supabase, me, q),
    // 근처(20km)에서 못 찾으면 전국으로 다시
    searchKakaoKeyword(q, at ? { ...at, radius: 20000 } : undefined).then((h) => (at && h !== null && h.length === 0 ? searchKakaoKeyword(q) : h)),
    searchPeople(supabase, q, me).catch(() => []),
  ]);
  const known = await knownKakaoPlaces(supabase, me, (hits ?? []).map((h) => h.id));
  const mineIds = new Set(mine.map((m) => m.placeId));
  const places = (hits ?? [])
    .map((h) => {
      const k = known.get(h.id);
      return {
        kakaoId: h.id,
        name: h.name,
        lat: h.lat,
        lng: h.lng,
        cuisine: h.cuisine,
        meta: [h.distance !== null && at ? km(h.distance) : null, h.categoryName, h.address].filter(Boolean).join(" · "),
        placeId: k?.placeId ?? null,
        tier: k?.tier ?? null,
      };
    })
    // 내 장소에 이미 나온 곳은 빼기 — 같은 장소 id, 또는 다른 출처로 저장해 id 가 달라도 이름 · 거리로 같은 가게
    .filter((p) => !(p.placeId && mineIds.has(p.placeId)))
    .filter((p) => !dedupeMine || !mine.some((m) => sameShop(m, p)));
  return { mine, places, people: people.slice(0, 5), placeSearch: hits !== null };
}

const OpenInput = z.object({ kakaoId: z.string().regex(/^\d{1,20}$/), name: z.string().min(1).max(100), lat: z.number(), lng: z.number() });

// 검색 결과 장소 열기 — 브라우저가 보낸 값은 믿지 않고 카카오에 다시 찾아 같은 가게일 때만 만든다
export async function openKakaoPlace(input: z.infer<typeof OpenInput>): Promise<{ placeId?: string; error?: string }> {
  const parsed = OpenInput.safeParse(input);
  if (!parsed.success) return { error: "열 수 없는 장소예요" };
  const { supabase } = await requireUser();
  const { kakaoId, name, lat, lng } = parsed.data;
  const hits = await searchKakaoKeyword(name, { lat, lng, radius: 300 }, 15);
  const hit = hits?.find((h) => h.id === kakaoId && isSamePlace({ name, lat, lng }, h));
  if (!hit) return { error: "장소 정보를 확인하지 못했어요. 다시 검색해 주세요." };
  try {
    const ids = await upsertPlaces(supabase, [hitToImportedPlace(hit)]);
    const placeId = ids.get(hit.id);
    return placeId ? { placeId } : { error: "장소를 열지 못했어요" };
  } catch {
    return { error: "장소를 열지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return { supabase, me };
}

// 검색 결과 거르기용 같은 가게 — 50m 안 + 정규화 이름 완전 일치 ('본가' · '본가국밥' 처럼 포함 관계는 다른 가게로)
function sameShop(a: { name: string; lat: number; lng: number }, b: { name: string; lat: number; lng: number }): boolean {
  return distanceMeters(a, b) <= 50 && normalizePlaceName(a.name) === normalizePlaceName(b.name);
}
