"use client";

import { useRouter } from "next/navigation";
import type { Tier } from "@/domain/tier";
import { PlaceMap } from "@/features/map/PlaceMap";

export function PlaceHeaderMap({ id, lat, lng, tier }: { id: string; lat: number; lng: number; tier: Tier }) {
  const router = useRouter();
  return (
    <div className="relative h-[180px] shrink-0 overflow-hidden bg-map-land">
      <div className="absolute inset-0">
        <PlaceMap pins={[{ id, lat, lng, tier }]} selectedId={id} onSelect={() => undefined} />
      </div>
      <button
        type="button"
        onClick={() => router.back()}
        aria-label="뒤로 가기"
        className="absolute top-3 left-3 z-10 flex size-11 items-center justify-center rounded-full bg-white shadow-float"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
    </div>
  );
}
