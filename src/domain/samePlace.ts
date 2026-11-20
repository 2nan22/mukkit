// 다른 출처에서 온 두 장소가 같은 가게인지 — 가까우면서 이름이 맞을 때만
export const SAME_PLACE_METERS = 50;

type Point = { name: string; lat: number; lng: number };

export function distanceMeters(a: Point, b: Point): number {
  const r = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

// 공백 · 기호 · 대소문자를 지운다 — "엉터리해장국 서여의도점" = "엉터리 해장국(서여의도점)"
export function normalizePlaceName(name: string): string {
  return name.toLowerCase().replace(/[\s()[\]{}·.,'"&\-_/]/g, "");
}

export function isSamePlace(a: Point, b: Point): boolean {
  if (distanceMeters(a, b) > SAME_PLACE_METERS) return false;
  const x = normalizePlaceName(a.name);
  const y = normalizePlaceName(b.name);
  if (x.length < 2 || y.length < 2) return x === y;
  return x === y || x.includes(y) || y.includes(x);
}
