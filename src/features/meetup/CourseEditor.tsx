"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MetaLine } from "@/components/ui/MetaLine";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { walkMinutes } from "@/domain/course";
import type { Course, CourseStop } from "./course";
import { CourseMap, courseShareText, legParts } from "./CourseMap";
import { useCourseDraft } from "./useCourseDraft";

const noSubscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => undefined;
};

// 코스 화면 (84) — 번호 핀 · 길, 1차 › 2차 목록, ≡ 끌어서(화살표 키) 순서 바꾸기 · 빼기, 아래 이 코스로 제안하기
export function CourseEditor({ meetupId, course, meetupUrl }: { meetupId: string; course: Course; meetupUrl: string }) {
  const draft = useCourseDraft(meetupId, course.stops.map((s) => s.placeId));
  const byId = new Map(course.stops.map((s) => [s.placeId, s]));
  const stops = draft.ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
  const route = draft.synced ? course.route : null;
  const [message, setMessage] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  // 키보드로 옮긴 줄의 ≡ 에 포커스를 돌려준다 — 아래로 옮기면 React 가 줄을 다시 끼워 포커스가 빠진다
  const focusId = useRef<string | null>(null);
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!focusId.current) return;
    list.current?.querySelector<HTMLButtonElement>(`[data-handle="${focusId.current}"]`)?.focus();
    focusId.current = null;
  });
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  function say(text: string) {
    setAnnounce("");
    setTimeout(() => setAnnounce(text), 50);
  }

  function move(from: number, to: number, byKey = false) {
    if (to < 0 || to >= stops.length || from === to) return;
    const next = stops.map((s) => s.placeId);
    const [id] = next.splice(from, 1);
    next.splice(to, 0, id);
    draft.change(next);
    if (byKey) focusId.current = id;
    say(`${byId.get(id)?.name ?? ""}을 ${to + 1}차로 옮겼어요`);
  }

  async function share() {
    const text = courseShareText(stops);
    if (canShare) return navigator.share({ title: "약속 코스", text, url: meetupUrl }).catch(() => undefined);
    try {
      await navigator.clipboard.writeText(`${text}\n${meetupUrl}`);
      setMessage("복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    } catch {
      setMessage("복사하지 못했어요.");
    }
  }

  const total = route ? route.legs.reduce((a, l) => a + l.seconds, 0) : 0;

  return (
    <div className="flex flex-col pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {stops.length > 0 && (
        <div className="relative h-[36dvh] min-h-56 overflow-hidden">
          <div className="absolute inset-0">
            <CourseMap stops={stops} route={route} />
          </div>
        </div>
      )}
      <section className="flex flex-col px-5 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-section font-bold tracking-[-0.02em]">코스 {stops.length}곳</h2>
          {route && (
            <span className="text-meta text-muted">
              모두 걸어서 {route.estimated ? "약 " : ""}
              {walkMinutes(total)}분
            </span>
          )}
        </div>
        {stops.length > 1 && <span className="pt-1 text-caption text-subtle">끌거나 화살표 키로 순서를 바꿀 수 있어요</span>}
        {stops.length === 0 && <p className="pt-2 text-meta text-muted">아직 담은 가게가 없어요. 약속 화면 가게 목록에서 코스에 담아 보세요.</p>}
        <ol ref={list} className="flex flex-col pt-3">
          {stops.map((s, i) => (
            <StopRow
              key={s.placeId}
              stop={s}
              index={i}
              count={stops.length}
              list={list}
              leg={route && i < route.legs.length ? legParts(route.legs[i].meters, route.legs[i].seconds, route.estimated) : null}
              onMove={move}
              onRemove={() => {
                draft.change(stops.filter((x) => x.placeId !== s.placeId).map((x) => x.placeId));
                say(`${s.name}을 코스에서 뺐어요`);
              }}
            />
          ))}
        </ol>
        <Link href={`/meet/${meetupId}`} className="flex h-11 items-center gap-1.5 self-start text-meta font-semibold text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          가게 더 담기
        </Link>
        {draft.error && (
          <p role="alert" className="text-meta text-danger">
            {draft.error}
          </p>
        )}
        <p aria-live="polite" className="sr-only">
          {announce}
        </p>
      </section>
      {stops.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[480px] flex-col gap-1.5 border-t border-line bg-white px-5 pt-2.5 pb-[calc(12px+env(safe-area-inset-bottom))]">
          {message ? (
            <p role="status" className="text-center text-meta text-ink-2">
              {message}
            </p>
          ) : (
            route?.estimated && <span className="text-center text-caption text-subtle">직선거리로 어림한 시간이에요</span>
          )}
          <button type="button" onClick={share} className="h-btn-m w-full rounded-btn-m bg-brand text-body font-bold text-white raised-brand">
            이 코스로 제안하기
          </button>
        </div>
      )}
    </div>
  );
}

// 한 줄 — 번호 · 이름 · 업종 · 빼기 · ≡. 놓을 자리는 다른 줄들의 가운데와 손가락 위치로 정한다(줄 높이가 달라도)
function StopRow({
  stop,
  index,
  count,
  list,
  leg,
  onMove,
  onRemove,
}: {
  stop: CourseStop;
  index: number;
  count: number;
  list: React.RefObject<HTMLOListElement | null>;
  leg: string[] | null;
  onMove: (from: number, to: number, byKey?: boolean) => void;
  onRemove: () => void;
}) {
  const [dy, setDy] = useState(0);
  const drag = useRef<{ startY: number; mids: number[] } | null>(null);

  function down(e: React.PointerEvent<HTMLButtonElement>) {
    if (count < 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rows = Array.from(list.current?.children ?? []) as HTMLElement[];
    drag.current = { startY: e.clientY, mids: rows.map((r) => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; }) };
  }
  function moveTo(e: React.PointerEvent<HTMLButtonElement>) {
    if (drag.current) setDy(e.clientY - drag.current.startY);
  }
  function up(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    drag.current = null;
    setDy(0);
    if (!d) return;
    // 손가락 위치보다 가운데가 위에 있는 다른 줄 수 = 놓을 자리
    const y = e.clientY;
    const to = d.mids.filter((m, i) => i !== index && m < y).length;
    if (to !== index) onMove(index, to);
  }

  const dragging = dy !== 0;
  return (
    <li style={dragging ? { transform: `translateY(${dy}px)`, zIndex: 10 } : undefined} className={`relative flex flex-col bg-white ${dragging ? "rounded-[12px] shadow-[0_6px_20px_rgba(0,0,0,0.12)]" : ""}`}>
      <div className="flex min-h-15 items-center gap-3">
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-meta font-bold text-white">
          {index + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body font-bold tracking-[-0.015em]">
            <span className="sr-only">{index + 1}차 </span>
            {stop.name}
          </span>
          <MetaLine items={[`${index + 1}차`, CUISINE_LABEL[stop.cuisine]]} />
        </span>
        <button type="button" onClick={onRemove} aria-label={`${stop.name} 코스에서 빼기`} className="flex size-11 shrink-0 items-center justify-center text-subtle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {count > 1 && (
          <button
            type="button"
            data-handle={stop.placeId}
            aria-label={`${stop.name} 순서 바꾸기, 지금 ${index + 1}차`}
            onPointerDown={down}
            onPointerMove={moveTo}
            onPointerUp={up}
            onPointerCancel={() => {
              drag.current = null;
              setDy(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                onMove(index, index + (e.key === "ArrowUp" ? -1 : 1), true);
              }
            }}
            className="-mr-3 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-subtle"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M5 9h14M5 15h14" />
            </svg>
          </button>
        )}
      </div>
      {/* 구간 줄은 끄는 동안 숨긴다 — 끄는 줄에 붙어 다니면 놓을 자리가 헷갈림 */}
      {leg && !dragging && (
        <div className="flex h-7 items-center gap-3">
          <span aria-hidden="true" className="flex w-7 shrink-0 justify-center">
            <span className="h-7 w-0.5 bg-[repeating-linear-gradient(#c8410b_0_3px,transparent_3px_6px)]" />
          </span>
          <MetaLine className="text-caption text-muted" items={leg} />
        </div>
      )}
    </li>
  );
}
