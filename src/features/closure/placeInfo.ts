import { distanceMeters } from "@/domain/samePlace";

// 출처(카카오 · 네이버)가 지금 알려 주는 가게 정보 — 새벽 폐업 확인 때 같이 받는다
export type PlaceInfo = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  categoryName: string;
  categoryPath: string[];
  cuisine: string;
};

export type StoredPlace = PlaceInfo & { id: string };

// 이보다 멀리 옮겼다고 나오면 같은 가게로 보기 어렵다 — 반영하지 않고 기록만
export const MAX_MOVE_METERS = 3000;

export type InfoPatch = Partial<{
  name: string;
  address: string;
  lat: number;
  lng: number;
  category_name: string;
  category_path: string[];
  cuisine: string;
}>;

// 바뀐 칸만 — 빈 값은 '모름'으로 보고 덮어쓰지 않는다
// far: 너무 멀리 옮겨져 반영하지 않음
export function diffPlaceInfo(stored: StoredPlace, fresh: PlaceInfo): { patch: InfoPatch; far: boolean } {
  const moved = distanceMeters({ name: "", lat: stored.lat, lng: stored.lng }, { name: "", lat: fresh.lat, lng: fresh.lng });
  if (moved > MAX_MOVE_METERS) return { patch: {}, far: true };
  const patch: InfoPatch = {};
  const name = fresh.name.trim();
  if (name && name !== stored.name) patch.name = name;
  const address = fresh.address.trim();
  if (address && address !== stored.address) patch.address = address;
  // 좌표는 몇 m 흔들림은 무시 — 이사처럼 눈에 띄게 옮겼을 때만
  if (moved > 30) {
    patch.lat = fresh.lat;
    patch.lng = fresh.lng;
  }
  if (fresh.categoryPath.length > 0 && fresh.categoryPath.join(">") !== stored.categoryPath.join(">")) {
    patch.category_path = fresh.categoryPath;
    if (fresh.categoryName) patch.category_name = fresh.categoryName;
    if (fresh.cuisine !== stored.cuisine) patch.cuisine = fresh.cuisine;
  }
  return { patch, far: false };
}
