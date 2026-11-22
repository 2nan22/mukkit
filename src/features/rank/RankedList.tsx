"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { RankPlace } from "./rank";

type Drag = { from: number; to: number; dy: number; h: number };
const EDGE = 96; // 화면 위 · 아래 이만큼 안에서 끌면 목록이 따라 스크롤
const SPEED = 10;

// 정한 3스타 목록 — 편집 모드에서는 ≡ 손잡이로 끌어서 순서를 바꾼다
// 키보드는 손잡이에서 위 · 아래 화살표. 바뀔 때마다 onMove 로 새 순서를 넘긴다
export function RankedList({
  ranked,
  editing,
  meta,
  onMove,
  onRedo,
  busy,
}: {
  ranked: RankPlace[];
  editing: boolean;
  meta: (p: RankPlace) => string;
  onMove: (next: RankPlace[], moved: RankPlace, to: number) => void;
  onRedo: (p: RankPlace) => void;
  busy: boolean;
}) {
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const handles = useRef<(HTMLButtonElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const live = useRef<{ from: number; startY: number; startScroll: number; tops: number[]; heights: number[]; lastY: number; to: number; dy: number } | null>(null);
  const raf = useRef(0);
  const [announce, setAnnounce] = useState("");
  const focusAt = useRef<number | null>(null);

  useEffect(() => {
    if (focusAt.current === null) return;
    handles.current[focusAt.current]?.focus();
    focusAt.current = null;
  });
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function move(from: number, to: number) {
    const list = ranked.slice();
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    onMove(list, item, to);
    setAnnounce(`${item.name}을 ${to + 1}위로 옮겼어요`);
  }

  function update(clientY: number) {
    const d = live.current;
    if (!d) return;
    d.lastY = clientY;
    const dy = clientY - d.startY + (window.scrollY - d.startScroll);
    const center = d.tops[d.from] + d.heights[d.from] / 2 + dy;
    let to = d.from;
    for (let j = 0; j < d.tops.length; j++) {
      const mid = d.tops[j] + d.heights[j] / 2;
      if (j < d.from && center < mid) to = Math.min(to, j);
      if (j > d.from && center > mid) to = Math.max(to, j);
    }
    d.to = to;
    d.dy = dy;
    setDrag({ from: d.from, to, dy, h: d.heights[d.from] });
  }

  function scrollLoop() {
    const d = live.current;
    if (!d) return;
    const step = d.lastY < EDGE ? -SPEED : d.lastY > window.innerHeight - EDGE ? SPEED : 0;
    if (step) {
      window.scrollBy(0, step);
      update(d.lastY);
    }
    raf.current = requestAnimationFrame(scrollLoop);
  }

  function onDown(e: PointerEvent<HTMLButtonElement>, i: number) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const tops = rows.current.map((r) => (r ? r.getBoundingClientRect().top + window.scrollY : 0));
    const heights = rows.current.map((r) => r?.offsetHeight ?? 0);
    live.current = { from: i, startY: e.clientY, startScroll: window.scrollY, tops, heights, lastY: e.clientY, to: i, dy: 0 };
    setDrag({ from: i, to: i, dy: 0, h: heights[i] });
    const onMoveEv = (ev: globalThis.PointerEvent) => update(ev.clientY);
    const onUp = () => {
      window.removeEventListener("pointermove", onMoveEv);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      cancelAnimationFrame(raf.current);
      const d = live.current;
      live.current = null;
      setDrag(null);
      if (d && d.to !== d.from) move(d.from, d.to);
    };
    window.addEventListener("pointermove", onMoveEv);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    raf.current = requestAnimationFrame(scrollLoop);
  }

  function shift(i: number): number {
    if (!drag) return 0;
    const h = drag.h;
    if (i === drag.from) return drag.dy;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) return -h;
    if (drag.to < drag.from && i >= drag.to && i < drag.from) return h;
    return 0;
  }

  return (
    <>
      <p role="status" className="sr-only">
        {announce}
      </p>
      <ol aria-label="3스타 순위" className="flex flex-col">
        {ranked.map((p, i) => {
          const dragging = drag?.from === i;
          return (
            <li
              key={p.placeId}
              ref={(el) => {
                rows.current[i] = el;
              }}
              style={{ transform: drag ? `translateY(${shift(i)}px)` : undefined }}
              className={`relative flex min-h-16 items-center gap-3 border-b border-line bg-white ${dragging ? "z-10 shadow-float" : drag ? "transition-transform duration-150" : ""}`}
            >
              <span className={`w-7 shrink-0 text-center text-section font-bold ${i < 3 ? "text-tier-3" : "text-ink-2"}`}>{i + 1}</span>
              {editing ? (
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
                  <span className="truncate text-body font-semibold">{p.name}</span>
                  <span className="truncate text-meta text-muted">{meta(p)}</span>
                </span>
              ) : (
                <Link href={`/p/${p.placeId}`} className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
                  <span className="truncate text-body font-semibold">{p.name}</span>
                  <span className="truncate text-meta text-muted">{meta(p)}</span>
                </Link>
              )}
              {editing ? (
                <button
                  type="button"
                  ref={(el) => {
                    handles.current[i] = el;
                  }}
                  onPointerDown={(e) => onDown(e, i)}
                  onKeyDown={(e) => {
                    const to = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : -1;
                    if (to < 0 || to >= ranked.length) return;
                    e.preventDefault();
                    focusAt.current = to;
                    move(i, to);
                  }}
                  aria-label={`${p.name} 순서 옮기기, 지금 ${i + 1}위. 위아래 화살표로 옮겨요`}
                  className="-mr-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <path d="M5 8h14M5 12h14M5 16h14" />
                  </svg>
                </button>
              ) : (
                ranked.length > 1 && (
                  <button type="button" disabled={busy} onClick={() => onRedo(p)} aria-label={`${p.name} 순위 다시 정하기`} className="h-11 min-w-11 shrink-0 px-2 text-meta text-ink-2">
                    다시 정하기
                  </button>
                )
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
