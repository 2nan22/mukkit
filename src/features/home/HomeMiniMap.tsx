"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlaceMap, type Pin } from "@/features/map/PlaceMap";
import type { HomePoint } from "./myHome";

const PADDING = [24, 24, 24, 24] as const;
const noop = () => {};

// 홈 내 지도 — 실제 카카오맵 미리보기. 화면에 들어올 때만 지도를 띄우고(SDK · 쿼터 아끼기),
// inert 로 만지거나 포커스가 들어가지 않게 — 누르면 위를 덮은 링크가 지도 탭으로
export function HomeMiniMap({ points }: { points: HomePoint[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const pins: Pin[] = useMemo(() => points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, tier: p.tier })), [points]);
  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <div ref={box} inert aria-hidden="true" className="relative h-[132px] w-full bg-map-land">
      {seen && <PlaceMap pins={pins} selectedId={null} onSelect={noop} padding={PADDING} cluster />}
    </div>
  );
}
