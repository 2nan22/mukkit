"use client";

import { useState } from "react";
import type { Cuisine } from "@/domain/cuisine";
import { CuisineIcon } from "./CuisineIcon";

// 장소 줄 썸네일 — 사용자가 올린 대표 사진, 없거나 주소가 만료되면 세부 업종 기본 그림
export function PlaceThumb({ src, cuisine, kind }: { src?: string | null; cuisine: Cuisine; kind?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return <CuisineIcon cuisine={cuisine} kind={kind} size={40} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
    <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="size-10 shrink-0 rounded-[12px] bg-surface object-cover ring-1 ring-black/5 ring-inset" />
  );
}
