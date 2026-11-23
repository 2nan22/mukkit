"use client";

import { PlaceMap, type Pin } from "@/features/map/PlaceMap";
import type { HomePoint } from "./myHome";

const PADDING = [24, 24, 24, 24] as const;
const noop = () => {};

// 홈 내 지도 — 실제 카카오맵에 내 장소 핀 (만지지 않는 미리보기, 누르면 지도 탭)
export function HomeMiniMap({ points }: { points: HomePoint[] }) {
  const pins: Pin[] = points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, tier: p.tier }));
  return (
    <span aria-hidden="true" className="pointer-events-none relative block h-[132px] w-full">
      <PlaceMap pins={pins} selectedId={null} onSelect={noop} padding={PADDING} cluster />
    </span>
  );
}
