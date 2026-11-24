"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { placeInThree } from "./actions";
import { compareSteps, type RankPlace } from "./rank";
import { MetaLine } from "@/components/ui/MetaLine";

function dot(d: string | null): string | null {
  return d ? `${d.replaceAll("-", ".")} 방문` : null;
}

// 같은 3숟가락 중 어디가 더 좋았나 — 이분 탐색으로 자리를 찾는다
// 카드를 누르면 그쪽이 더 좋음 · 비슷해요는 비교한 곳 바로 아래 · cancelLabel(나중에 할게요 등)은 순위 없이 닫기
// 정하고 나면 결과('3숟가락 중 N위예요')를 보여 주고, remaining 이 있으면(이어 정하기) 다음 곳으로 갈지 묻는다
export function CompareSheet({
  target,
  ranked,
  label = "방금 평가",
  cancelLabel = "나중에 할게요",
  remaining = 0,
  afterOf,
  scope,
  onDone,
}: {
  // ranked 가 전체 순위의 일부(같은 업종)일 때 — 그 안의 자리 pos 를 전체 순위에서 '누구 바로 아래'로 바꿔 준다 (67-2)
  afterOf?: (pos: number) => string | null;
  // 비교 범위 안내 — '일식 3숟가락끼리 비교해요'
  scope?: string;
  target: RankPlace;
  ranked: RankPlace[];
  label?: string;
  cancelLabel?: string;
  remaining?: number;
  onDone: (result: { rank: number } | null, next: boolean) => void;
}) {
  const [lo, setLo] = useState(0);
  const [hi, setHi] = useState(ranked.length);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<"target" | "other" | null>(null);
  const [result, setResult] = useState<number | null>(null);
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
      const after = afterOf ? afterOf(pos) : pos === 0 ? null : ranked[pos - 1].placeId;
      const res = await placeInThree(target.placeId, after);
      if (res.error) {
        setPicked(null);
        return setError(res.error);
      }
      setResult(res.rank ?? pos + 1);
    });
  }
  // better: 이 곳(target)이 비교한 곳보다 좋음
  function answer(better: boolean) {
    const [nlo, nhi] = better ? [lo, mid] : [mid + 1, hi];
    if (nlo >= nhi) return save(nlo);
    setLo(nlo);
    setHi(nhi);
    setStep((s) => s + 1);
    setPicked(null);
  }
  // 누른 카드를 잠깐 검정 테두리로 보여 준 뒤 다음 단계로
  function pick(which: "target" | "other") {
    if (picked || pending) return;
    setPicked(which);
    setTimeout(() => answer(which === "target"), 200);
  }
  const close = () => onDone(result === null ? null : { rank: result }, false);

  const card = (p: RankPlace, tag: string, selected: boolean, onPick: () => void) => (
    <button
      type="button"
      disabled={pending}
      aria-pressed={selected}
      onClick={onPick}
      className={`flex min-h-42 flex-col gap-1.5 rounded-[14px] bg-white p-4 text-left disabled:opacity-60 ${selected ? "border-[1.5px] border-ink" : "border border-line-strong"}`}
    >
      <span className="text-caption font-bold text-muted">{tag}</span>
      <span className="text-[17px] leading-snug font-bold">{p.name}</span>
      <MetaLine items={[CUISINE_LABEL[p.cuisine], regionOf(p.address)]} />
      {dot(p.visitedOn) && <span className="mt-auto text-meta text-muted">{dot(p.visitedOn)}</span>}
    </button>
  );

  if (!other) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={close}>
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cmp-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && close()}
        className="flex w-full max-w-[480px] flex-col rounded-t-[20px] bg-white pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none"
      >
        <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-9 rounded-full bg-line-strong" />
        <div className="flex items-center justify-between pt-2 pr-2 pl-5">
          <span className="text-meta text-muted" aria-live="polite">
            <MetaLine className="" items={[result === null && `최대 ${total}번 중 ${step}번`, remaining > 0 && `남은 ${remaining}곳`]} />
          </span>
          <button type="button" onClick={close} aria-label="닫기" className="flex size-11 items-center justify-center text-ink">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {result !== null ? (
          <div className="flex flex-col gap-1.5 px-5 pt-2">
            <h2 id="cmp-title" className="text-title leading-snug font-bold tracking-tight">
              {target.name}
              <br />
              3숟가락 중 {result}위예요
            </h2>
            <p className="text-meta text-muted">순위는 나만 봐요.</p>
            <div className={`grid gap-2 pt-6 ${remaining > 0 ? "grid-cols-2" : ""}`}>
              {remaining > 0 && (
                <button type="button" onClick={() => onDone({ rank: result }, false)} className="h-12 rounded-btn-m border border-line-strong text-body text-ink">
                  그만하기
                </button>
              )}
              <button type="button" onClick={() => onDone({ rank: result }, remaining > 0)} className="h-12 rounded-btn-m bg-ink text-body font-bold text-white">
                {remaining > 0 ? "다음 곳 정하기" : "확인"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5 px-5">
              <h2 id="cmp-title" className="text-title leading-snug font-bold tracking-tight">
                같은 3숟가락 중
                <br />
                어디가 더 좋았나요?
              </h2>
              <p className="text-meta text-muted">{scope ? `${scope}. 순위는 나만 봐요` : "더 좋았던 곳을 눌러 주세요."}</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 px-5 pt-6">
              {card(target, label, picked === "target", () => pick("target"))}
              {card(other, `3숟가락 ${(other.rank ?? mid) + 1}위`, picked === "other", () => pick("other"))}
            </div>
            {error && (
              <p role="alert" className="px-5 pt-3 text-meta text-danger">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 px-5 pt-4">
              <button type="button" disabled={pending || picked !== null} onClick={() => save(mid + 1)} className="h-12 rounded-btn-m border border-line-strong text-body text-ink disabled:opacity-60">
                비슷해요
              </button>
              <button type="button" onClick={close} className="h-12 rounded-btn-m text-body text-muted">
                {cancelLabel}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
