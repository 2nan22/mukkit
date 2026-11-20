"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CUISINE_LABEL, type Cuisine } from "@/domain/cuisine";
import { TIER_LABEL, TIER_MEANING, type Tier } from "@/domain/tier";
import { loadNextUnrated, setTier } from "./actions";
import type { SavedPlace } from "./rating";

const CHOICES: { tier: Tier; className: string }[] = [
  { tier: "three", className: "bg-tier-3-soft text-tier-3" },
  { tier: "two", className: "bg-tier-2-soft text-tier-2" },
  { tier: "one", className: "bg-tier-1-soft text-tier-1" },
  { tier: "notRecommended", className: "bg-surface-2 text-ink-2" },
];

export function QuickRate({ initial, total }: { initial: SavedPlace | null; total: number }) {
  const [place, setPlace] = useState(initial);
  const [done, setDone] = useState<SavedPlace[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(total);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadNext(skip: string[]) {
    return loadNextUnrated(skip).then((res) => {
      setPlace(res.place);
      setRemaining(res.remaining);
    });
  }

  function rate(tier: Tier) {
    if (!place) return;
    const current = place;
    startTransition(async () => {
      const res = await setTier(current.placeId, tier);
      if (res.error) return setError(res.error);
      setError(null);
      setDone((d) => [...d, current]);
      await loadNext(skipped);
    });
  }

  function skip() {
    if (!place) return;
    const next = [...skipped, place.placeId];
    setSkipped(next);
    startTransition(() => loadNext(next));
  }

  function undo() {
    const last = done.at(-1);
    if (!last) return;
    startTransition(async () => {
      const res = await setTier(last.placeId, "unrated");
      if (res.error) return setError(res.error);
      setError(null);
      setDone((d) => d.slice(0, -1));
      setRemaining((r) => r + 1);
      setPlace(last);
    });
  }

  function retrySkipped() {
    setSkipped([]);
    startTransition(() => loadNext([]));
  }

  // 이번에 평가한 수 대 아직 남은 평가 전 — 건너뛴 곳은 남은 쪽에 그대로 있다
  const scale = done.length + remaining;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col gap-2 px-5 pt-1">
        <div className="flex justify-between text-meta text-muted">
          <span>
            평가함 <b className="text-ink">{done.length}</b>
          </span>
          <span>남은 평가 전 {remaining}곳</span>
        </div>
        <div
          role="progressbar"
          aria-label="평가 진행률"
          aria-valuemin={0}
          aria-valuemax={scale}
          aria-valuenow={done.length}
          className="h-1 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full bg-ink transition-[width]" style={{ width: `${scale ? (done.length / scale) * 100 : 0}%` }} />
        </div>
      </div>

      {place ? (
        <>
          <article aria-live="polite" className={`mx-5 mt-5 flex flex-col gap-1 rounded-2xl border border-line p-4 ${pending ? "opacity-60" : ""}`}>
            <span className="text-meta text-muted">{placeMeta(place)}</span>
            <h2 className="text-title font-bold tracking-tight">{place.name}</h2>
            {place.note && (
              <p className="mt-1.5 rounded-btn-s bg-surface px-3 py-2.5 text-meta leading-normal text-ink-2">
                <span className="text-muted">내 메모</span> · {place.note}
              </p>
            )}
          </article>

          <section className="flex flex-1 flex-col gap-2 px-5 pt-5">
            <span className="text-body font-bold">어땠나요?</span>
            <div className="grid grid-cols-2 gap-2">
              {CHOICES.map(({ tier, className }) => (
                <button
                  key={tier}
                  type="button"
                  disabled={pending}
                  onClick={() => rate(tier)}
                  className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-btn-l px-2 py-2 disabled:opacity-60 ${className}`}
                >
                  <span className="text-body font-bold">{TIER_LABEL[tier]}</span>
                  <span className="text-caption opacity-80">{TIER_MEANING[tier]}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => rate("wantToGo")}
              className="h-btn-l rounded-btn-l border border-line-strong text-body text-ink disabled:opacity-60"
            >
              아직 안 가봤어요
            </button>
            {error && (
              <p role="alert" className="text-meta text-[#c4320a]">
                {error}
              </p>
            )}
          </section>

          <div className="flex items-center justify-between px-5 pt-2 pb-5">
            <button
              type="button"
              onClick={undo}
              disabled={pending || done.length === 0}
              className="flex h-btn-m items-center gap-1 text-meta text-muted disabled:invisible"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 14L4 9l5-5" />
                <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
              </svg>
              되돌리기
            </button>
            <button type="button" onClick={skip} disabled={pending} className="h-btn-m text-meta text-muted">
              잘 모르겠어요 · 건너뛰기
            </button>
          </div>
        </>
      ) : (
        <section className="flex flex-1 flex-col gap-3 px-5 pt-10">
          <h2 className="text-title font-bold tracking-tight">
            {skipped.length > 0 ? `건너뛴 ${skipped.length}곳이 남았어요` : "평가 전인 곳을 다 봤어요"}
          </h2>
          <p className="text-body leading-normal text-ink-2">
            {done.length > 0 ? `이번에 ${done.length}곳을 평가했어요.` : "평가할 곳이 없어요."} 평가는 언제든 장소에서 바꿀 수 있어요.
          </p>
          <div className="flex-1" />
          <div className="flex flex-col gap-2 pb-5">
            {skipped.length > 0 && (
              <button
                type="button"
                onClick={retrySkipped}
                disabled={pending}
                className="h-btn-l rounded-btn-l border border-line-strong text-[16px] font-bold text-ink"
              >
                건너뛴 곳 다시 보기
              </button>
            )}
            <Link href="/home" className="flex h-btn-l items-center justify-center rounded-btn-l bg-ink text-[16px] font-bold text-white">
              홈으로
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function placeMeta(place: SavedPlace): string {
  const region = place.address.split(" ").slice(0, 2).join(" ");
  const cuisine = CUISINE_LABEL[place.cuisine as Cuisine];
  return [...new Set([cuisine, place.categoryName, region])].filter(Boolean).join(" · ");
}
