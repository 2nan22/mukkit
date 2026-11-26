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
  // 이름 낱말이 모두 들어 있는 곳 — '명동교자 본점' ↔ '명동교자 명동역점 신관 본점' (구글 · 카카오 표기 차이)
  const words = item.name.split(/\s+/).map(normalizePlaceName).filter((w) => w.length > 0);
  const loose = hits.filter((h) => {
    const n = normalizePlaceName(h.name);
    if (want.length < 2 || n.length < 2) return false;
    return n.includes(want) || want.includes(n) || (words.length > 1 && words.every((w) => n.includes(w)));
  });

  if (item.lat !== undefined && item.lng !== undefined) {
    const at = { name: item.name, lat: item.lat, lng: item.lng };
    const near = (exact.length > 0 ? exact : loose).filter((h) => distanceMeters(at, h) <= NEAR_METERS);
    const food = near.filter((h) => FOOD.has(h.group)).sort((a, b) => distanceMeters(at, a) - distanceMeters(at, b));
    if (food[0]) return { hit: food[0] };
    return near.length > 0 ? { reason: "not_food" } : { reason: "not_found" };
  }

  // 이름이 똑같은 곳이 먼저, 없으면 두 낱말 이상이 모두 든 곳 — 어느 쪽이든 한 곳으로 좁혀질 때만
  // (좌표 없이 한 낱말 포함은 받지 않는다 — '온도'로 '온도카페'를 고르지 않게)
  const byWords = words.length > 1 ? hits.filter((h) => words.every((w) => normalizePlaceName(h.name).includes(w))) : [];
  const pool = exact.length > 0 ? exact : byWords;
  const food = pool.filter((h) => FOOD.has(h.group));
  if (food.length === 1) return { hit: food[0] };
  if (food.length > 1) {
    const saved = food.filter((h) => mine.has(h.id));
    return saved.length === 1 ? { hit: saved[0] } : { reason: "ambiguous" };
  }
  return pool.length > 0 ? { reason: "not_food" } : { reason: "not_found" };
}

// 좌표가 없을 때 검색어 — 주소가 있으면 앞 두 마디(시 · 구)를 붙여 좁힌다
export function searchQuery(item: GoogleItem): string {
  // 한글 주소일 때만 — 영어 주소 앞 마디는 검색어를 흐린다
  const region = item.address && /[가-힣]/.test(item.address) ? item.address.replace(/^대한민국\s*/, "").split(/\s+/).slice(0, 2).join(" ") : "";
  return item.lat === undefined && region ? `${region} ${item.name}` : item.name;
}
