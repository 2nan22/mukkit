import { timedFetch } from "@/lib/http/timedFetch";
import { z } from "zod";
import { KAKAO_FOLDER } from "@/features/import/kakao/config";
import { kakaoCuisineOf } from "@/features/import/kakao/kakaoCuisine";
import { NaverSharedListSource } from "@/features/import/naver/naverSharedListSource";
import type { PlaceInfo } from "./placeInfo";

type FetchLike = typeof fetch;
const KAKAO_CONCURRENCY = 4;

const KakaoSummarySchema = z.object({
  summary: z.object({
    name: z.string().optional(),
    address: z.object({ disp: z.string().optional() }).nullable().optional(),
    category: z.object({ name1: z.string().optional(), name2: z.string().optional(), name3: z.string().optional() }).nullable().optional(),
    point: z.object({ lat: z.number(), lon: z.number() }).nullable().optional(),
  }),
});

// 카카오 상세에서 가게 정보 — 가져올 때(kakaoFolderSource)와 같은 규칙. 좌표가 없으면 정보 없음
export function kakaoInfoOf(body: unknown): PlaceInfo | null {
  const parsed = KakaoSummarySchema.safeParse(body);
  if (!parsed.success || !parsed.data.summary.point || !parsed.data.summary.name) return null;
  const s = parsed.data.summary;
  const categoryPath = [s.category?.name1, s.category?.name2, s.category?.name3].filter((v): v is string => !!v);
  return {
    name: s.name!,
    address: s.address?.disp ?? "",
    lat: s.point!.lat,
    lng: s.point!.lon,
    categoryName: s.category?.name3 ?? s.category?.name2 ?? "",
    categoryPath,
    cuisine: kakaoCuisineOf(categoryPath).cuisine,
  };
}

// 카카오 장소 상세를 다시 읽는다 — 200(본문 정상)이면 영업, 404 면 폐업, 그 밖은 모름(결과에 없음)
// info: 영업 중인 곳의 지금 가게 정보 (이름 · 주소 · 좌표 · 업종)
export async function checkKakaoPlaces(
  ids: string[],
  fetchImpl: FetchLike = timedFetch,
): Promise<{ results: Map<string, boolean>; unknown: number; info: Map<string, PlaceInfo> }> {
  const results = new Map<string, boolean>();
  const info = new Map<string, PlaceInfo>();
  let unknown = 0;
  await mapLimit(ids, KAKAO_CONCURRENCY, async (id) => {
    const res = await fetchImpl(KAKAO_FOLDER.placeUrl(id), { headers: KAKAO_FOLDER.placeHeaders }).catch(() => null);
    if (res?.status === 404) return void results.set(id, false);
    const body: unknown = res?.ok ? await res.json().catch(() => null) : null;
    if (body && typeof body === "object" && "summary" in body) {
      results.set(id, true);
      const i = kakaoInfoOf(body);
      if (i) info.set(id, i);
      return;
    }
    unknown += 1;
  });
  return { results, unknown, info };
}

// 네이버는 장소 하나를 읽는 통로가 없다 — 가져온 공유 리스트를 다시 읽어 각 장소의 available 을 쓴다
export async function checkNaverLists(
  listIds: string[],
  source = new NaverSharedListSource(),
): Promise<{ results: Map<string, boolean>; failedLists: number; info: Map<string, PlaceInfo> }> {
  const results = new Map<string, boolean>();
  const info = new Map<string, PlaceInfo>();
  let failedLists = 0;
  for (const listId of listIds) {
    try {
      const list = await source.fetchList(listId);
      for (const p of list.places) {
        results.set(p.sourcePlaceId, p.available);
        if (p.available) info.set(p.sourcePlaceId, { name: p.name, address: p.address, lat: p.lat, lng: p.lng, categoryName: p.categoryName, categoryPath: p.categoryPath, cuisine: p.cuisine });
      }
    } catch {
      // 비공개로 바뀌었거나 지운 리스트 — 그 장소들은 판단하지 않는다
      failedLists += 1;
    }
  }
  return { results, failedLists, info };
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}
