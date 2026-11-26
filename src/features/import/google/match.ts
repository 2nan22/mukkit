import { distanceMeters, normalizePlaceName } from "@/domain/samePlace";
import type { KakaoHit } from "@/features/search/kakaoLocal";
import type { GoogleItem } from "./takeout";

// 구글 항목 → 카카오 가게 고르기 (76) — 틀린 가게를 넣느니 못 찾은 곳으로 남긴다
// - 좌표가 있으면: 300m 안에서 이름이 맞는 가장 가까운 곳
// - 좌표가 없으면(저장됨 CSV 대부분): 이름이 똑같은 곳이 한 곳뿐일 때만. 여럿이면 이미 내 장소인 곳 하나만
export const NEAR_METERS = 300;
const FOOD = new Set(["FD6", "CE7"]);

export type Pick = { hit: KakaoHit } | { reason: "not_found" | "ambiguous" | "not_food" };

export function pickHit(item: GoogleItem, hits: KakaoHit[], mine: ReadonlySet<string> = new Set()): Pick {
  const want = normalizePlaceName(item.name);
  if (want.length === 0) return { reason: "not_found" };
  const exact = hits.filter((h) => normalizePlaceName(h.name) === want);
  const loose = hits.filter((h) => {
    const n = normalizePlaceName(h.name);
    return want.length >= 2 && n.length >= 2 && (n.includes(want) || want.includes(n));
  });

  if (item.lat !== undefined && item.lng !== undefined) {
    const at = { name: item.name, lat: item.lat, lng: item.lng };
    const near = (exact.length > 0 ? exact : loose).filter((h) => distanceMeters(at, h) <= NEAR_METERS);
    const food = near.filter((h) => FOOD.has(h.group)).sort((a, b) => distanceMeters(at, a) - distanceMeters(at, b));
    if (food[0]) return { hit: food[0] };
    return near.length > 0 ? { reason: "not_food" } : { reason: "not_found" };
  }

  const food = exact.filter((h) => FOOD.has(h.group));
  if (food.length === 1) return { hit: food[0] };
  if (food.length > 1) {
    const saved = food.filter((h) => mine.has(h.id));
    return saved.length === 1 ? { hit: saved[0] } : { reason: "ambiguous" };
  }
  return exact.length > 0 ? { reason: "not_food" } : { reason: "not_found" };
}

// 좌표가 없을 때 검색어 — 주소가 있으면 앞 두 마디(시 · 구)를 붙여 좁힌다
export function searchQuery(item: GoogleItem): string {
  const region = item.address ? item.address.replace(/^대한민국\s*/, "").split(/\s+/).slice(0, 2).join(" ") : "";
  return item.lat === undefined && region ? `${region} ${item.name}` : item.name;
}
