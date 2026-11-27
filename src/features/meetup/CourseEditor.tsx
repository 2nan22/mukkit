"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MetaLine } from "@/components/ui/MetaLine";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { meetLeg, straightRoute, walkMinutes } from "@/domain/course";
import type { Course, CourseStop } from "./course";
import { CourseMap, MeetRow, courseShareText, legParts } from "./CourseMap";
import type { MeetPoint } from "./meetup";
import { useCourseDraft } from "./useCourseDraft";

const noSubscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => undefined;
};

// 코스 화면 (84) — 번호 핀 · 길, 1차 › 2차 목록, ≡ 끌어서(화살표 키) 순서 바꾸기 · 빼기, 아래 이 코스로 제안하기
// 끌기 · 빼기는 화면에서만 바뀌고 '이 순서로 저장'을 눌러야 저장 · 걷는 길을 다시 잰다 (88-3) — 그 전엔 직선 어림
export function CourseEditor({ meetupId, course, meet = null, meetupUrl }: { meetupId: string; course: Course; meet?: MeetPoint | null; meetupUrl: string }) {
  const draft = useCourseDraft(meetupId, course.stops.map((s) => s.placeId), { manual: true });
  const byId = new Map(course.stops.map((s) => [s.placeId, s]));
  const stops = draft.ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
  const route = draft.synced ? course.route : stops.length >= 2 ? straightRoute(stops) : null;
  // 끄는 중 — 잡은 줄은 손가락을 따라가고, 사이 줄들은 잡은 줄 높이만큼 비켜 준다
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; height: number } | null>(null);
  const dragStart = useRef<{ y: number; mids: number[] } | null>(null);
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

  function dragBegin(index: number, y: number) {
    const rows = Array.from(list.current?.children ?? []) as HTMLElement[];
    const rects = rows.map((r) => r.getBoundingClientRect());
    dragStart.current = { y, mids: rects.map((b) => b.top + b.height / 2) };
    setDrag({ from: index, to: index, dy: 0, height: rects[index]?.height ?? 0 });
  }
  function dragMove(y: number) {
    const st = dragStart.current;
    if (!st || !drag) return;
    const dy = y - st.y;
    const center = st.mids[drag.from] + dy;
    const to = st.mids.filter((m, i) => i !== drag.from && m < center).length;
    setDrag({ ...drag, to, dy });
  }
  function dragEnd() {
    const d = drag;
    dragStart.current = null;
    setDrag(null);
    if (d && d.to !== d.from) move(d.from, d.to);
  }
  // 끄는 동안 보일 순서 번호 — 놓을 자리 기준으로 미리 (88-3 검토)
  function shownIndex(i: number): number {
    if (!drag) return i;
    if (i === drag.from) return drag.to;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return i - 1;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return i + 1;
    return i;
  }
  // 사이 줄이 비켜 줄 거리 — 줄 높이는 모두 같다(마지막 줄도 구간 자리를 비워 둠)
  function shiftOf(i: number): number {
    if (!drag || i === drag.from) return 0;
    const h = drag.height;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -h;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) return h;
    return 0;
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

  // 만날 곳 › 1차 — 약속 화면 코스 카드와 같은 줄 · 같은 합계 (88-2, 1차를 바꾸면 그 자리에서 어림)
  const toFirst = meetLeg(meet, stops[0], draft.synced ? course.meetWalk : null);
  const meetSec = toFirst && !toFirst.atFirst ? toFirst.leg.seconds : 0;
  const total = (route ? route.legs.reduce((a, l) => a + l.seconds, 0) : 0) + meetSec;
  const showTotal = Boolean(route || (meetSec && stops.length === 1));
  const totalEstimated = Boolean(route?.estimated || (meetSec && toFirst?.estimated));

  return (
    <div className="flex flex-col pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {stops.length > 0 && (
        <div className="relative h-[36dvh] min-h-56 overflow-hidden">
          <div className="absolute inset-0">
            <CourseMap stops={stops} route={route} meet={meet} meetWalk={draft.synced ? course.meetWalk : null} />
          </div>
        </div>
      )}
      <section className="flex flex-col px-5 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-section font-bold tracking-[-0.02em]">코스 {stops.length}곳</h2>
          {showTotal && (
            <span className="text-meta text-muted">
              모두 걸어서 {totalEstimated ? "약 " : ""}
              {walkMinutes(total)}분
            </span>
          )}
        </div>
        {stops.length > 1 && <span className="pt-1 text-caption text-subtle">끌거나 화살표 키로 순서를 바꿀 수 있어요</span>}
        {stops.length === 0 && <p className="pt-2 text-meta text-muted">아직 담은 가게가 없어요. 약속 화면 가게 목록에서 코스에 담아 보세요.</p>}
        {/* 만날 곳은 끌 수 없어 목록(ol) 밖 — 끌기 자리 계산이 ol 줄만 보게 */}
        {meet && toFirst && !toFirst.atFirst && (
          <div className="pt-3">
            <MeetRow label={meet.label} leg={legParts(toFirst.leg.meters, toFirst.leg.seconds, toFirst.estimated)} iconCol="grid-cols-[1.75rem_1fr_auto] gap-3" />
          </div>
        )}
        <ol ref={list} className={`flex flex-col ${meet && toFirst && !toFirst.atFirst ? "" : "pt-3"}`}>
          {stops.map((s, i) => (
            <StopRow
              key={s.placeId}
              stop={s}
              index={i}
              shown={shownIndex(i)}
              locked={draft.saving}
              count={stops.length}
              dragging={drag?.from === i ? drag.dy : null}
              anyDragging={drag !== null}
              shift={shiftOf(i)}
              onDragBegin={dragBegin}
              onDragMove={dragMove}
              onDragEnd={dragEnd}
              leg={route && i < route.legs.length ? legParts(route.legs[i].meters, route.legs[i].seconds, route.estimated) : null}
              onMove={move}
              onRemove={() => {
                if (draft.saving) return;
                draft.change(stops.filter((x) => x.placeId !== s.placeId).map((x) => x.placeId));
                say(`${s.name}을 코스에서 뺐어요`);
              }}
            />
          ))}
        </ol>
{/* 저장 안 한 순서가 있으면 숨김 — 다른 화면으로 가면 고친 게 사라짐 */}
        {!draft.changed && (
                  <Link href={`/meet/${meetupId}`} className="flex h-11 items-center gap-1.5 self-start text-meta font-semibold text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          가게 더 담기
        </Link>
        )}
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
          {draft.changed ? (
            <>
              <span className="text-center text-caption text-subtle">저장하면 걷는 길을 다시 재요</span>
              <div className="flex gap-2">
                <button type="button" onClick={draft.revert} disabled={draft.saving} className="h-btn-m flex-1 rounded-btn-m bg-surface text-body font-semibold text-ink disabled:opacity-60">
                  되돌리기
                </button>
                <button type="button" onClick={draft.commit} disabled={draft.saving} className="h-btn-m flex-[2] rounded-btn-m bg-brand text-body font-bold text-white raised-brand disabled:opacity-60">
                  {draft.saving ? "저장하는 중" : "이 순서로 저장"}
                </button>
              </div>
            </>
          ) : (
            <>
              {message ? (
                <p role="status" className="text-center text-meta text-ink-2">
                  {message}
                </p>
              ) : (
                route?.estimated && <span className="text-center text-caption text-subtle">직선거리로 어림한 시간이에요</span>
              )}
              <button type="button" onClick={share} disabled={draft.saving} className="h-btn-m w-full rounded-btn-m bg-brand text-body font-bold text-white raised-brand disabled:opacity-60">
                이 코스로 제안하기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 한 줄 — 번호 · 이름 · 업종 · 빼기 · ≡. 끌기 상태는 화면(CourseEditor)이 쥐고, 줄은 손가락 위치만 알린다
function StopRow({
  stop,
  index,
  shown,
  locked,
  count,
  dragging,
  anyDragging,
  shift,
  onDragBegin,
  onDragMove,
  onDragEnd,
  leg,
  onMove,
  onRemove,
}: {
  stop: CourseStop;
  index: number;
  shown: number;
  locked: boolean;
  count: number;
  dragging: number | null;
  anyDragging: boolean;
  shift: number;
  onDragBegin: (index: number, y: number) => void;
  onDragMove: (y: number) => void;
  onDragEnd: () => void;
  leg: string[] | null;
  onMove: (from: number, to: number, byKey?: boolean) => void;
  onRemove: () => void;
}) {
  function down(e: React.PointerEvent<HTMLButtonElement>) {
    if (count < 2 || locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    onDragBegin(index, e.clientY);
  }

  const held = dragging !== null;
  return (
    <li
      style={held ? { transform: `translateY(${dragging}px)`, zIndex: 10 } : shift ? { transform: `translateY(${shift}px)` } : undefined}
      className={`relative flex flex-col ${held ? "" : anyDragging ? "transition-transform duration-150 ease-out" : ""}`}
    >
      {/* 그림자 카드는 가게 줄만 — 아래 구간 자리는 감쌈에서 뺌 */}
      <div className={`flex min-h-15 items-center gap-3 bg-white ${held ? "-mx-2 rounded-[12px] px-2 shadow-[0_6px_20px_rgba(0,0,0,0.12)]" : ""}`}>
        <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-meta font-bold text-white">
          {shown + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body font-bold tracking-[-0.015em]">
            <span className="sr-only">{index + 1}차 </span>
            {stop.name}
          </span>
          <MetaLine items={[`${shown + 1}차`, CUISINE_LABEL[stop.cuisine]]} />
        </span>
        <button type="button" onClick={onRemove} disabled={locked} aria-label={`${stop.name} 코스에서 빼기`} className="flex size-11 shrink-0 items-center justify-center text-subtle disabled:opacity-40">
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
            onPointerMove={(e) => held && onDragMove(e.clientY)}
            onPointerUp={() => held && onDragEnd()}
            onPointerCancel={() => held && onDragEnd()}
            onKeyDown={(e) => {
              if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !locked) {
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
      {/* 구간 줄은 끄는 동안 모두 가린다 — 마지막 줄도 같은 자리를 둬서 줄 높이가 모두 같게(비켜 주는 거리가 맞게) */}
      <div className={`flex h-7 items-center gap-3 ${anyDragging || !leg ? "invisible" : ""}`} aria-hidden={!leg || undefined}>
        <span aria-hidden="true" className="flex w-7 shrink-0 justify-center">
          <span className="h-7 w-0.5 bg-[repeating-linear-gradient(#c8410b_0_3px,transparent_3px_6px)]" />
        </span>
        {leg && <MetaLine className="text-caption text-muted" items={leg} />}
      </div>
    </li>
  );
}
