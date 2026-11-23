import { timedFetch } from "@/lib/http/timedFetch";
import { z } from "zod";
import type { Cuisine } from "@/domain/cuisine";
import type { ImportedPlace } from "@/domain/importedPlace";
import { kakaoCuisineOf } from "@/features/import/kakao/kakaoCuisine";

// 카카오 로컬 키워드 검색 — 서버에서만 (REST 키)
const SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

const DocSchema = z.object({
  id: z.string(),
  place_name: z.string(),
  category_name: z.string(),
  address_name: z.string(),
  road_address_name: z.string(),
  x: z.string(),
  y: z.string(),
  distance: z.string().optional(),
  category_group_code: z.string().optional(),
});
const ResponseSchema = z.object({ documents: z.array(DocSchema) });

export type KakaoHit = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  categoryPath: string[];
  categoryName: string;
  cuisine: Cuisine;
  distance: number | null;
  // 카카오 업종 묶음 — FD6 음식점 · CE7 카페 (그 밖은 병원 · 증권사 등)
  group: string;
};

const FOOD_GROUPS = new Set(["FD6", "CE7"]);

// 먹킷 장소가 될 수 있는 곳 — 음식점 · 카페만 (검색에 성형외과 · 증권사가 섞여 장소로 만들어지던 것)
export function isFoodHit(hit: KakaoHit): boolean {
  return FOOD_GROUPS.has(hit.group);
}

type Near = { lat: number; lng: number; radius?: number };

// null = 키가 없어 검색할 수 없음, [] = 결과 없음
export async function searchKakaoKeyword(query: string, near?: Near, size = 15): Promise<KakaoHit[] | null> {
  const r = await searchKakaoKeywordOrFail(query, near, size);
  return r === "failed" ? [] : r;
}

// 실패(오류 · 한도 초과 · 네트워크)를 '0건'과 구분해야 하는 곳 — 'failed', 키가 없으면 null
export async function searchKakaoKeywordOrFail(query: string, near?: Near, size = 15): Promise<KakaoHit[] | null | "failed"> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) return null;
  const params = new URLSearchParams({ query, size: String(size) });
  if (near) {
    params.set("x", String(near.lng));
    params.set("y", String(near.lat));
    if (near.radius) params.set("radius", String(near.radius));
  }
  const res = await timedFetch(`${SEARCH_URL}?${params}`, { headers: { Authorization: `KakaoAK ${key}` } }).catch(() => null);
  if (!res?.ok) {
    // 키는 남기지 않는다 — 상태 코드와 카카오 오류 종류만
    const body = res ? await res.json().catch(() => null) : null;
    console.warn("[kakao local] 검색 실패", res?.status ?? "network", body?.errorType ?? "", body?.message ?? "");
    return "failed";
  }
  const parsed = ResponseSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) return "failed";
  return parsed.data.documents.map(toHit);
}

function toHit(d: z.infer<typeof DocSchema>): KakaoHit {
  const categoryPath = d.category_name.split(">").map((s) => s.trim()).filter(Boolean);
  return {
    id: d.id,
    name: d.place_name,
    lat: Number(d.y),
    lng: Number(d.x),
    address: d.road_address_name || d.address_name,
    categoryPath,
    categoryName: categoryPath.at(-1) ?? "",
    cuisine: kakaoCuisineOf(categoryPath).cuisine,
    distance: d.distance ? Number(d.distance) : null,
    group: d.category_group_code ?? "",
  };
}

export function hitToImportedPlace(hit: KakaoHit): ImportedPlace {
  return {
    source: "kakao",
    sourcePlaceId: hit.id,
    name: hit.name,
    lat: hit.lat,
    lng: hit.lng,
    address: hit.address,
    categoryPath: hit.categoryPath,
    categoryName: hit.categoryName,
    cuisine: hit.cuisine,
    memo: "",
    savedAt: new Date(),
    available: true,
    raw: { via: "search" },
  };
}
