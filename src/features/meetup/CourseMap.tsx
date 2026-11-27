"use client";

import { useMemo } from "react";
import { meetLeg, metersLabel, walkMinutes, type CourseRoute } from "@/domain/course";
import { PlaceMap, type Pin } from "@/features/map/PlaceMap";
import { MetaLine } from "@/components/ui/MetaLine";
import type { CourseStop } from "./course";
import type { MeetPoint } from "./meetup";

// 코스 지도 — 번호 핀 · 길(실제 길은 실선, 직선 어림은 점선) (84) · 만날 곳 깃발 (88-2, 1차에서 바로 만나면 겹쳐서 뺌)
export function CourseMap({ stops, route, meet = null, onSelect }: { stops: CourseStop[]; route: CourseRoute | null; meet?: MeetPoint | null; onSelect?: (placeId: string) => void }) {
  const showMeet = Boolean(meet && meetLeg(meet, stops[0], null)?.atFirst === false);
  const pins = useMemo(() => {
    const course: Pin[] = stops.map((s, i) => ({ id: s.placeId, lat: s.lat, lng: s.lng, tier: "unrated" as const, order: i + 1 }));
    return meet && showMeet ? [...course, { id: "meet", lat: meet.lat, lng: meet.lng, tier: "unrated" as const, kind: "meet" as const, label: meet.label }] : course;
  }, [stops, meet, showMeet]);
  const line = useMemo(() => (route ? { path: route.path, dashed: route.estimated } : null), [route]);
  // 만날 곳에서 1차까지 — 받아 둔 길 모양은 없어 곧은 점선 (목록 줄과 같은 뜻)
  const approach = useMemo<[number, number][] | null>(() => (meet && showMeet && stops[0] ? [[meet.lng, meet.lat], [stops[0].lng, stops[0].lat]] : null), [meet, showMeet, stops]);
  return <PlaceMap pins={pins} route={line} approach={approach} selectedId={null} onSelect={(id) => onSelect?.(id)} padding={[40, 40, 40, 40]} quiet />;
}

// 만날 곳 줄 — 깃발 · 이름 · '만날 곳', 아래 1차까지 걷는 구간 (코스 카드 · 코스 화면 공통, 86 · 88-2)
export function MeetRow({ label, leg, iconCol }: { label: string; leg: string[]; iconCol: string }) {
  return (
    <div className="flex flex-col">
      <div className={`grid min-h-8 ${iconCol} items-center`}>
        <span aria-hidden="true" className="flex justify-center text-ink">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M6 21V4h11l-2 4 2 4H6" />
          </svg>
        </span>
        <span className="truncate text-[14px] font-semibold">{label}</span>
        <span className="text-caption text-subtle">만날 곳</span>
      </div>
      <div className={`grid h-6 ${iconCol} items-center`}>
        <span aria-hidden="true" className="flex justify-center">
          <span className="h-6 w-0.5 bg-[repeating-linear-gradient(#c8410b_0_3px,transparent_3px_6px)]" />
        </span>
        <MetaLine className="col-span-2 text-caption text-muted" items={leg} />
      </div>
    </div>
  );
}

// 구간 줄 — ['걸어서 9분', '650m'] (MetaLine 으로 나눔). 직선 어림이면 '약'
export function legParts(meters: number, seconds: number, estimated: boolean): string[] {
  return [`걸어서 ${estimated ? "약 " : ""}${walkMinutes(seconds)}분`, metersLabel(meters)];
}

// 공유 문구 — 머리 줄 + 1차 2차 가게 이름 (위치 · 동네는 싣지 않음) · 약속 화면 · 코스 화면 같은 말
export function courseShareText(stops: { name: string }[]): string {
  return ["약속 코스", ...stops.map((s, i) => `${i + 1}차 ${s.name}`)].join("\n");
}
