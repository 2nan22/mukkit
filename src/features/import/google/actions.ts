"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ImportedList, ImportedPlace } from "@/domain/importedPlace";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { hitToImportedPlace, searchKakaoKeywordOrFail, type KakaoHit } from "@/features/search/kakaoLocal";
import { knownKakaoPlaces } from "@/features/search/search";
import { allowCall } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ImportSaveError, saveImportedList } from "../saveImportedList";
import { pickHit, searchQuery } from "./match";

// 구글 테이크아웃 리스트 하나를 카카오 가게로 맞춰 저장 (76) — 화면이 리스트마다 한 번씩 부른다
// 받는 값은 기기가 파일에서 읽은 이름 · 메모 · 좌표 · 주소뿐. 가게 정보는 서버가 카카오에서 직접 받은 것만 저장(32)
const ItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  note: z.string().max(1000),
  url: z.string().max(1000),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  address: z.string().max(200).optional(),
});
const ListSchema = z.object({
  key: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  wantToGo: z.boolean(),
  items: z.array(ItemSchema).min(1).max(500),
});

export type GoogleImportResult =
  | { ok: true; listId: string | null; added: number; alreadySaved: number; missed: { name: string; reason: MissReason }[] }
  | { ok: false; error: string };
export type MissReason = "not_found" | "ambiguous" | "not_food" | "failed";

// 한 번에 카카오에 묻는 수 · 리스트 가져오기는 사용자당 1분에 10번
const CONCURRENCY = 4;
const LISTS_PER_MINUTE = 10;
const LISTS_PER_DAY = 40;

export async function importGoogleList(input: z.input<typeof ListSchema>): Promise<GoogleImportResult> {
  const parsed = ListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "파일 내용을 읽지 못했어요. 다른 파일로 다시 시도해 주세요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  if (!allowCall(`google-import:${me}`, LISTS_PER_MINUTE, 60_000)) return { ok: false, error: "잠깐만요. 1분쯤 뒤에 다시 시도해 주세요." };
  // 카카오 검색 한도 보호 — 하루 리스트 수 (한 리스트 최대 500곳)
  if (!allowCall(`google-import-day:${me}`, LISTS_PER_DAY, 86_400_000)) return { ok: false, error: "오늘은 더 가져올 수 없어요. 내일 다시 시도해 주세요." };

  const list = parsed.data;
  const searched = await mapLimit(list.items, CONCURRENCY, (item) =>
    searchKakaoKeywordOrFail(searchQuery(item), item.lat !== undefined && item.lng !== undefined ? { lat: item.lat, lng: item.lng, radius: 500 } : undefined, 15),
  );
  if (searched.some((r) => r === null)) return { ok: false, error: "지금은 가게를 찾을 수 없어요. 잠시 후 다시 시도해 주세요." };
  // 이름이 같은 곳이 여럿이면 이미 내 장소인 곳으로 — 후보 카카오 ID 를 한 번에 확인
  const candidateIds = [...new Set(searched.flatMap((r) => (Array.isArray(r) ? r.map((h) => h.id) : [])))];
  const known = await knownKakaoPlaces(supabase, me, candidateIds);
  const mine = new Set([...known].filter(([, v]) => v.tier !== null).map(([id]) => id));

  const places: ImportedPlace[] = [];
  const missed: { name: string; reason: MissReason }[] = [];
  list.items.forEach((item, i) => {
    const hits = searched[i];
    if (!Array.isArray(hits)) return missed.push({ name: item.name, reason: "failed" });
    const pick = pickHit(item, hits as KakaoHit[], mine);
    if ("reason" in pick) return missed.push({ name: item.name, reason: pick.reason });
    places.push({ ...hitToImportedPlace(pick.hit), origin: "google", memo: item.note.slice(0, 1000), raw: { google: { name: item.name, url: item.url } } });
  });

  const imported: ImportedList = {
    source: "kakao",
    origin: "google",
    sourceListId: `takeout:${list.key}`,
    name: list.name,
    memo: "",
    places,
    expectedCount: list.items.length,
    skipped: missed.map((m, index) => ({ index, reason: m.reason })),
  };
  if (places.length === 0) return { ok: true, listId: null, added: 0, alreadySaved: 0, missed };
  try {
    const saved = await saveImportedList(supabase, me, imported, list.wantToGo ? { kind: "tier", tier: "want_to_go" } : { kind: "plain" });
    return { ok: true, listId: saved.listId, added: saved.added, alreadySaved: saved.alreadySaved, missed };
  } catch (error) {
    if (error instanceof ImportSaveError) return { ok: false, error: "저장하지 못했어요. 다시 시도해 주세요." };
    throw error;
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
