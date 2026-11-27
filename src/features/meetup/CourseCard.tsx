"use client";

import Link from "next/link";
import { MetaLine } from "@/components/ui/MetaLine";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { googleRouteLink, kakaoRouteLink, naverRouteLink } from "@/domain/mapLinks";
import { meetLeg, walkMinutes } from "@/domain/course";
import type { MeetPoint } from "./meetup";
import { RouteButton } from "@/features/place/RouteButton";
import type { Course } from "./course";
import { MeetRow, legParts } from "./CourseMap";

// 약속 화면 코스 카드 (84) — 함께 정한 1차 › 2차 · 코스 고치기 · 1차 길찾기
// 지도는 약속 화면 아래 지도 하나에 (89) — 카드는 목록만. onChangeMeet: 만날 곳 줄 '바꾸기'
export function CourseCard({
  meetupId,
  course,
  editable,
  meet = null,
  onChangeMeet,
}: {
  meetupId: string;
  course: Course;
  editable: boolean;
  meet?: MeetPoint | null;
  onChangeMeet?: () => void;
}) {
  const { stops, route } = course;
  if (stops.length === 0) return null;
  const first = stops[0];
  // 만날 곳에서 1차까지 — 가까우면(1차 가게에서 바로 만남) 따로 줄을 두지 않고 1차 줄에 '만날 곳'. 받아 둔 길이 있으면 실제 걷는 길 (88)
  const toFirst = meetLeg(meet, first, course.meetWalk);
  const meetAtFirst = Boolean(toFirst?.atFirst);
  // '모두 걸어서'는 만날 곳 줄이 있으면 그 구간도 더한다 — 줄은 있는데 합계에 빠지면 헷갈림 (88 검토)
  const meetSec = toFirst && !meetAtFirst ? toFirst.leg.seconds : 0;
  const total = route || meetSec ? walkMinutes((route?.legs ?? []).reduce((a, l) => a + l.seconds, 0) + meetSec) : null;
  const totalEstimated = Boolean(route?.estimated || (meetSec && toFirst?.estimated));
  return (
    <section aria-label="약속 코스" className="overflow-hidden rounded-[16px] border border-line">
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[16px] font-bold tracking-[-0.015em]">코스 {stops.length}곳</h2>
          {total !== null && (
            <span className="text-meta text-muted">
              모두 걸어서 {totalEstimated ? "약 " : ""}
              {total}분
            </span>
          )}
        </div>
        {/* 오른쪽은 늘 업종, 걷는 시간은 두 줄 사이 점선 줄에 (코스 화면과 같은 말투, 84 검토) */}
        <ol className="flex flex-col">
          {/* 만날 곳에서 1차까지 (86 · 88) */}
          {meet && toFirst && !meetAtFirst && (
            <li>
              <MeetRow
                label={meet.label}
                leg={legParts(toFirst.leg.meters, toFirst.leg.seconds, toFirst.estimated)}
                iconCol="grid-cols-[2.25rem_1fr_auto] gap-2"
                action={
                  editable && onChangeMeet ? (
                    <button type="button" onClick={onChangeMeet} aria-label="만날 곳 바꾸기" className="-my-2 flex h-11 items-center text-caption font-semibold text-ink">
                      바꾸기
                    </button>
                  ) : undefined
                }
              />
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
