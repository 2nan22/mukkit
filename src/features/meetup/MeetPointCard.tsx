"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { findSpots, type Spot } from "@/features/eat/actions";
import { setMeetPoint } from "./actions";
import type { MeetPoint } from "./meetup";

// 받침 따라 '로' · '으로' (을지로입구역으로 · 홍대로)
function ro(word: string): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return "로";
  const jong = c % 28;
  return jong === 0 || jong === 8 ? "로" : "으로";
}

type Option = { key: string; label: string; sub: string; lat: number; lng: number; area: string | null };

const FlagIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 21V4h11l-2 4 2 4H6" />
  </svg>
);

// 만날 곳 카드 (86) — 정했으면 그곳, 안 정했으면 지금 고른 지역의 대표 역을 '추천'으로. 바꾸기는 시트
export function MeetPointCard({
  meetupId,
  meet,
  viewing = null,
  suggested,
  options,
  onPickArea,
  open: openProp,
  onOpenChange,
  cardHidden = false,
}: {
  // 바깥에서 여닫기 — 코스 카드 만날 곳 줄 '바꾸기' (89). cardHidden 이면 카드 없이 시트만
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  cardHidden?: boolean;
  meetupId: string;
  meet: MeetPoint | null;
  // 만날 곳과 다른 지역 칩을 보고 있을 때 그 지역 대표 역 — '여기로 바꾸기'
  viewing?: Option | null;
  suggested: Option | null;
  options: Option[];
  onPickArea?: (area: string) => void;
}) {
  const [openSelf, setOpenSelf] = useState(false);
  const open = openProp ?? openSelf;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOpenSelf(v));
  const [moving, startMove] = useTransition();
  // 아직 정하지 않았고 권할 곳도 없으면(출발지가 모이기 전, 91) '정하기'만
  const shown = meet ? { label: meet.label } : suggested;
  if (cardHidden) return open ? <MeetPointSheet meetupId={meetupId} current={meet} options={options} onClose={() => setOpen(false)} onPickArea={onPickArea ?? (() => undefined)} /> : null;
  return (
    <>
      <div className="flex items-center gap-3 rounded-[14px] border border-line px-3.5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-surface text-ink">
          <FlagIcon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption text-muted">{meet ? "만날 곳" : shown ? "추천 만날 곳" : "만날 곳"}</span>
          {shown ? (
            <span className="truncate text-body font-bold tracking-[-0.015em]">{shown.label}</span>
          ) : (
            <span className="truncate text-body text-muted">동네가 정해졌다면 먼저 골라 두세요</span>
          )}
        </span>
        <button type="button" onClick={() => setOpen(true)} className="flex h-11 shrink-0 items-center px-1 text-meta font-semibold text-ink">
          {meet ? "바꾸기" : "정하기"}
        </button>
      </div>
      {viewing && (
        // 다른 지역을 보는 중 — 시간 카드는 그 지역 기준이라 만날 곳과 섞이지 않게 알려 준다 (86 검토)
        <div className="-mt-2 flex items-center justify-between gap-3 px-1">
          <span className="min-w-0 truncate text-meta text-muted">지금은 {viewing.sub.replace("추천 지역 ", "")}을 보고 있어요</span>
          <button
            type="button"
            disabled={moving}
            onClick={() => startMove(async () => void (await setMeetPoint({ meetupId, point: { label: viewing.label, lat: viewing.lat, lng: viewing.lng, area: viewing.area } })))}
            className="flex h-11 shrink-0 items-center text-meta font-semibold text-ink underline underline-offset-[3px] disabled:opacity-40"
          >
            {viewing.label}
            {ro(viewing.label)} 바꾸기
          </button>
        </div>
      )}
      {open && <MeetPointSheet meetupId={meetupId} current={meet} options={options} onClose={() => setOpen(false)} onPickArea={onPickArea ?? (() => undefined)} />}
    </>
  );
}

function MeetPointSheet({
  meetupId,
  current,
  options,
  onClose,
  onPickArea,
}: {
  meetupId: string;
  current: MeetPoint | null;
  options: Option[];
  onClose: () => void;
  onPickArea: (area: string) => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  // 지금 만날 곳 — 목록에 없으면(찾아서 정함 · 순위가 바뀜) 맨 위 줄로. 맞추기는 좌표로
  const same = (o: Option) => Boolean(current) && Math.abs(o.lat - current!.lat) < 1e-6 && Math.abs(o.lng - current!.lng) < 1e-6;
  const list = current && !options.some(same) ? [{ key: "current", label: current.label, sub: "지금 만날 곳", lat: current.lat, lng: current.lng, area: current.area }, ...options] : options;
  const [picked, setPicked] = useState<Option | null>(() => list.find(same) ?? null);
  const [query, setQuery] = useState("");
  const [spots, setSpots] = useState<Spot[] | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    sheet.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function search() {
    const q = query.trim();
    if (!q) return;
    startSearch(async () => {
      const res = await findSpots(q);
      setSpots(res.spots ?? []);
      if (res.error) setError(res.error);
    });
  }

  function save(point: Option | null) {
    setError(null);
    startSave(async () => {
      const res = await setMeetPoint({ meetupId, point: point ? { label: point.label, lat: point.lat, lng: point.lng, area: point.area } : null });
      if (res.error) return setError(res.error);
      if (point?.area) onPickArea(point.area);
      onClose();
    });
  }

  const radio = (o: Option) => {
    const on = picked?.key === o.key;
    return (
      <button
        key={o.key}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => setPicked(o)}
        className={`flex min-h-15 items-center gap-3 rounded-[14px] px-3.5 py-2.5 text-left ${on ? "ring-[1.5px] ring-ink" : "ring-1 ring-line"}`}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-body font-bold">{o.label}</span>
          <span className="text-caption text-muted">{o.sub}</span>
        </span>
        {on && (
          <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5 9-10" />
            </svg>
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="meet-point-title"
        tabIndex={-1}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-[88dvh] w-full max-w-[480px] flex-col gap-3.5 overflow-y-auto rounded-t-[20px] bg-white px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] outline-none"
      >
        <span aria-hidden="true" className="h-1 w-9 self-center rounded-full bg-line-strong" />
        <div className="flex flex-col gap-1">
          <h2 id="meet-point-title" className="text-section font-bold tracking-[-0.02em]">
            어디서 만날까요?
          </h2>
          <span className="text-meta text-muted">함께하는 분들 모두에게 보여요</span>
        </div>
        <div role="radiogroup" aria-label="만날 곳" className="flex flex-col gap-2">
          {list.map(radio)}
          {spots?.map((s) => radio({ key: `s${s.id}`, label: s.name, sub: s.meta.join(", ") || "찾은 곳", lat: s.lat, lng: s.lng, area: null }))}
        </div>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
          className="flex flex-col gap-1.5"
        >
          <label htmlFor="meet-point-search" className="text-meta font-semibold text-ink-2">
            다른 곳 찾기
          </label>
          <div className="flex gap-1.5">
            <input
              id="meet-point-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={40}
              enterKeyHint="search"
              placeholder="역, 출구, 건물 이름"
              className="h-11 min-w-0 flex-1 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink [&::-webkit-search-cancel-button]:hidden"
            />
            <button type="submit" disabled={!query.trim() || searching} className="h-11 shrink-0 rounded-[12px] bg-surface px-4 text-meta font-semibold text-ink disabled:opacity-40">
              {searching ? "찾는 중" : "찾기"}
            </button>
          </div>
          {spots && spots.length === 0 && <span className="text-meta text-muted">찾는 곳이 없어요. 다른 이름으로 찾아 주세요.</span>}
        </form>
        {error && (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
        <button type="button" disabled={!picked || saving} onClick={() => save(picked)} className="h-btn-m w-full rounded-btn-m bg-ink text-body font-bold text-white disabled:opacity-40">
          {saving ? "정하는 중" : "여기서 만나기"}
        </button>
        {current && (
          <button type="button" disabled={saving} onClick={() => save(null)} className="h-11 self-center text-meta text-muted underline underline-offset-[3px]">
            만날 곳 지우기
          </button>
        )}
      </div>
    </div>
  );
}

export type { Option as MeetOption };
