"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { placeInThree } from "./actions";
import { compareSteps, type RankPlace } from "./rank";

function dot(d: string | null): string | null {
  return d ? `${d.replaceAll("-", ".")} 방문` : null;
}

// 같은 3스타 중 어디가 더 좋았나 — 이분 탐색으로 자리를 찾는다
// 카드를 누르면 그쪽이 더 좋음 · 비슷해요는 비교한 곳 바로 아래 · 나중에 할게요는 순위 없이 닫기
export function CompareSheet({
  target,
  ranked,
  label = "방금 평가",
  onDone,
}: {
  target: RankPlace;
  ranked: RankPlace[];
  label?: string;
  onDone: (result: { rank: number } | null) => void;
}) {
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(ranked.length);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheet = useRef<HTMLElement>(null);
  const total = compareSteps(ranked.length);
  const mid = (lo + hi) >> 1;
  const other = ranked[mid];

  useEffect(() => {
    sheet.current?.focus();
  }, []);

  function save(pos: number) {
    start(async () => {
      const res = await placeInThree(target.placeId, pos === 0 ? null : ranked[pos - 1].placeId);
      if (res.error) return setError(res.error);
      onDone({ rank: res.rank ?? pos + 1 });
    });
  }
  // better: 이 곳(target)이 비교한 곳보다 좋음
  function answer(better: boolean) {
    const [nlo, nhi] = better ? [lo, mid] : [mid + 1, hi];
    if (nlo >= nhi) return save(nlo);
    setLo(nlo);
    setHi(nhi);
    setStep((s) => s + 1);
  }

  const card = (p: RankPlace, tag: string, selected: boolean, onPick: () => void) => (
    <button
      type="button"
      disabled={pending}
      onClick={onPick}
      className={`flex min-h-42 flex-col gap-1.5 rounded-[14px] bg-white p-4 text-left disabled:opacity-60 ${selected ? "border-[1.5px] border-ink" : "border border-line-strong"}`}
    >
      <span className={`text-caption font-bold ${selected ? "text-ink" : "text-muted"}`}>{tag}</span>
      <span className="text-[17px] leading-snug font-bold">{p.name}</span>
      <span className="text-meta text-muted">{[CUISINE_LABEL[p.cuisine], regionOf(p.address)].filter(Boolean).join(" · ")}</span>
      {dot(p.visitedOn) && <span className="mt-auto text-meta text-muted">{dot(p.visitedOn)}</span>}
    </button>
  );

  if (!other) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45">
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmp-title"
        onKeyDown={(e) => e.key === "Escape" && onDone(null)}
        className="flex w-full max-w-[480px] flex-col rounded-t-[20px] bg-white pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none"
      >
        <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-full bg-line-strong" />
        <div className="flex items-center justify-between pt-2 pr-2 pl-5">
          <span className="text-meta text-muted" aria-live="polite">
            {step} / {total}
          </span>
          <button type="button" onClick={() => onDone(null)} aria-label="닫기" className="flex size-11 items-center justify-center text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-1.5 px-5">
          <h2 id="cmp-title" className="text-title leading-snug font-bold tracking-tight">
            같은 3스타 중
            <br />
            어디가 더 좋았나요?
          </h2>
          <p className="text-meta text-muted">몇 번만 고르면 3스타 안에서 순위가 정해져요.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-6">
          {card(target, label, true, () => answer(true))}
          {card(other, `3스타 · ${mid + 1}위`, false, () => answer(false))}
        </div>
        {error && (
          <p role="alert" className="px-5 pt-3 text-meta text-danger">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 px-5 pt-4">
          <button type="button" disabled={pending} onClick={() => save(mid + 1)} className="h-12 rounded-btn-m border border-line-strong text-body text-ink disabled:opacity-60">
            비슷해요
          </button>
          <button type="button" onClick={() => onDone(null)} className="h-12 rounded-btn-m text-body text-muted">
            나중에 할게요
          </button>
        </div>
      </section>
    </div>
  );
}
