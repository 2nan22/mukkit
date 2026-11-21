import { KAKAO_FOLDER } from "@/features/import/kakao/config";
import { NaverSharedListSource } from "@/features/import/naver/naverSharedListSource";

type FetchLike = typeof fetch;
const KAKAO_CONCURRENCY = 4;

// 카카오 장소 상세를 다시 읽는다 — 200(본문 정상)이면 영업, 404 면 폐업, 그 밖은 모름(결과에 없음)
export async function checkKakaoPlaces(ids: string[], fetchImpl: FetchLike = fetch): Promise<{ results: Map<string, boolean>; unknown: number }> {
  const results = new Map<string, boolean>();
  let unknown = 0;
  await mapLimit(ids, KAKAO_CONCURRENCY, async (id) => {
    const res = await fetchImpl(KAKAO_FOLDER.placeUrl(id), { headers: KAKAO_FOLDER.placeHeaders }).catch(() => null);
    if (res?.status === 404) return void results.set(id, false);
    const body: unknown = res?.ok ? await res.json().catch(() => null) : null;
    if (body && typeof body === "object" && "summary" in body) return void results.set(id, true);
    unknown += 1;
  });
  return { results, unknown };
}

// 네이버는 장소 하나를 읽는 통로가 없다 — 가져온 공유 리스트를 다시 읽어 각 장소의 available 을 쓴다
export async function checkNaverLists(
  listIds: string[],
  source = new NaverSharedListSource(),
): Promise<{ results: Map<string, boolean>; failedLists: number }> {
  const results = new Map<string, boolean>();
  let failedLists = 0;
  for (const listId of listIds) {
    try {
      const list = await source.fetchList(listId);
      for (const p of list.places) results.set(p.sourcePlaceId, p.available);
    } catch {
      // 비공개로 바뀌었거나 지운 리스트 — 그 장소들은 판단하지 않는다
      failedLists += 1;
    }
  }
  return { results, failedLists };
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}
