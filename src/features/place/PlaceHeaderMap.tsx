"use client";

import { useState } from "react";
import { useLeave } from "@/lib/nav/useLeave";
import type { Tier } from "@/domain/tier";
import { honor } from "@/domain/honor";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { PlaceCover } from "./covers";

// 장소 상세 위쪽 — 대표 사진(사용자가 올린 평가 사진)이 있으면 사진, '지도 보기'로 바꿔 보기. 없으면 지도
export function PlaceHeaderMap({ id, lat, lng, tier, cover = null }: { id: string; lat: number; lng: number; tier: Tier; cover?: PlaceCover | null }) {
  const leave = useLeave("/home");
  const [showMap, setShowMap] = useState(!cover);
  return (
    <div className={`relative shrink-0 overflow-hidden bg-map-land ${cover ? "h-[220px]" : "h-[180px]"}`}>
      {cover && !showMap ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
        <img src={cover.url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0">
          <PlaceMap pins={[{ id, lat, lng, tier }]} selectedId={id} onSelect={() => undefined} />
        </div>
      )}
      <button
        type="button"
        onClick={leave}
        aria-label="뒤로"
        className="absolute top-3 left-3 z-10 flex size-11 items-center justify-center rounded-full bg-white shadow-float"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      {cover && (
        <div className="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-2">
          {!showMap ? (
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-caption text-white">{cover.mine ? "내 사진" : `${honor(cover.ownerNickname)} 사진`}</span>
          ) : (
            <span />
          )}
          <button type="button" onClick={() => setShowMap(!showMap)} className="flex h-11 items-center">
            <span className="flex h-8 items-center rounded-full bg-white px-3 text-meta font-semibold text-ink shadow-float">{showMap ? "사진 보기" : "지도 보기"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
