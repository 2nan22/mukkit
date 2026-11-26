"use client";

import Link from "next/link";
import { MetaLine } from "@/components/ui/MetaLine";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { googleRouteLink, kakaoRouteLink, naverRouteLink } from "@/domain/mapLinks";
import { straightRoute, walkMinutes } from "@/domain/course";
import type { MeetPoint } from "./meetup";
import { RouteButton } from "@/features/place/RouteButton";
import type { Course } from "./course";
import { CourseMap, legParts } from "./CourseMap";

// 약속 화면 코스 카드 (84) — 함께 정한 1차 › 2차 · 미니 지도 · 코스 고치기 · 1차 길찾기
export function CourseCard({ meetupId, course, editable, meet = null }: { meetupId: string; course: Course; editable: boolean; meet?: MeetPoint | null }) {
  const { stops, route } = course;
  if (stops.length === 0) return null;
  const first = stops[0];
  const total = route ? walkMinutes(route.legs.reduce((a, l) => a + l.seconds, 0)) : null;
  // 만날 곳에서 1차까지 — 50m 안이면(1차 가게에서 바로 만남) 따로 줄을 두지 않고 1차 줄에 '만날 곳'
  const toFirst = meet ? straightRoute([meet, first]).legs[0] : null;
  const meetAtFirst = Boolean(toFirst && toFirst.meters < 65);
  return (
    <section aria-label="약속 코스" className="overflow-hidden rounded-[16px] border border-line">
      <div className="relative h-40">
        <div className="absolute inset-0">
          <CourseMap stops={stops} route={route} />
        </div>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-bold tracking-[-0.015em]">코스 {stops.length}곳</h2>
          {total !== null && (
            <span className="text-meta text-muted">
              모두 걸어서 {route?.estimated ? "약 " : ""}
              {total}분
            </span>
          )}
        </div>
        {/* 오른쪽은 늘 업종, 걷는 시간은 두 줄 사이 점선 줄에 (코스 화면과 같은 말투, 84 검토) */}
        <ol className="flex flex-col">
          {/* 만날 곳에서 1차까지 — 걸어서 어림 (86) */}
          {meet && toFirst && !meetAtFirst && (
            <li className="flex flex-col">
              <div className="grid min-h-8 grid-cols-[2.25rem_1fr_auto] items-center gap-2">
                <span aria-hidden="true" className="flex justify-center text-ink">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                    <path d="M6 21V4h11l-2 4 2 4H6" />
                  </svg>
                </span>
                <span className="truncate text-[14px] font-semibold">{meet.label}</span>
                <span className="text-caption text-subtle">만날 곳</span>
              </div>
              <div className="grid h-6 grid-cols-[2.25rem_1fr] items-center gap-2">
                <span aria-hidden="true" className="flex justify-center">
                  <span className="h-6 w-0.5 bg-[repeating-linear-gradient(#c8410b_0_3px,transparent_3px_6px)]" />
                </span>
                <MetaLine className="text-caption text-muted" items={legParts(toFirst.meters, toFirst.seconds, true)} />
              </div>
            </li>
          )}
          {stops.map((s, i) => (
            <li key={s.placeId} className="flex flex-col">
              <div className="grid min-h-8 grid-cols-[2.25rem_1fr_auto] items-center gap-2">
                <span className="text-caption font-bold text-ink">{i + 1}차</span>
                <Link href={`/p/${s.placeId}`} className="truncate text-[14px] font-semibold">
                  {s.name}
                </Link>
                <span className="text-caption text-subtle">{i === 0 && meetAtFirst ? "만날 곳" : CUISINE_LABEL[s.cuisine]}</span>
              </div>
              {route && i < route.legs.length && (
                <div className="grid h-6 grid-cols-[2.25rem_1fr] items-center gap-2">
                  <span aria-hidden="true" className="flex justify-center">
                    <span className="h-6 w-0.5 bg-[repeating-linear-gradient(#c8410b_0_3px,transparent_3px_6px)]" />
                  </span>
                  <MetaLine className="text-caption text-muted" items={legParts(route.legs[i].meters, route.legs[i].seconds, route.estimated)} />
                </div>
              )}
            </li>
          ))}
        </ol>
        <div className="flex gap-2 pt-1">
          {editable && (
            <Link href={`/meet/${meetupId}/course`} className="flex h-11 flex-1 items-center justify-center rounded-[12px] bg-surface text-[14px] font-semibold text-ink">
              코스 고치기
            </Link>
          )}
          <RouteButton
            label={`1차 ${first.name} 길찾기`}
            links={{ kakao: kakaoRouteLink(first.name, first.lat, first.lng), naver: naverRouteLink(first.name, first.lat, first.lng), google: googleRouteLink(first.lat, first.lng) }}
            className="flex h-11 flex-1 items-center justify-center rounded-[12px] bg-surface text-[14px] font-semibold text-ink"
          >
            1차 길찾기
          </RouteButton>
        </div>
      </div>
    </section>
  );
}
