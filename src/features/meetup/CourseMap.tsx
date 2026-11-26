"use client";

import { useMemo } from "react";
import { metersLabel, walkMinutes, type CourseRoute } from "@/domain/course";
import { PlaceMap } from "@/features/map/PlaceMap";
import type { CourseStop } from "./course";

// 코스 지도 — 번호 핀 · 길(실제 길은 실선, 직선 어림은 점선) (84)
export function CourseMap({ stops, route, onSelect }: { stops: CourseStop[]; route: CourseRoute | null; onSelect?: (placeId: string) => void }) {
  const pins = useMemo(() => stops.map((s, i) => ({ id: s.placeId, lat: s.lat, lng: s.lng, tier: "unrated" as const, order: i + 1 })), [stops]);
  const line = useMemo(() => (route ? { path: route.path, dashed: route.estimated } : null), [route]);
  return <PlaceMap pins={pins} route={line} selectedId={null} onSelect={(id) => onSelect?.(id)} padding={[40, 40, 40, 40]} quiet />;
}

// 구간 줄 — ['걸어서 9분', '650m'] (MetaLine 으로 나눔). 직선 어림이면 '약'
export function legParts(meters: number, seconds: number, estimated: boolean): string[] {
  return [`걸어서 ${estimated ? "약 " : ""}${walkMinutes(seconds)}분`, metersLabel(meters)];
}

// 공유 문구 — 머리 줄 + 1차 2차 가게 이름 (위치 · 동네는 싣지 않음) · 약속 화면 · 코스 화면 같은 말
export function courseShareText(stops: { name: string }[]): string {
  return ["약속 코스", ...stops.map((s, i) => `${i + 1}차 ${s.name}`)].join("\n");
}
