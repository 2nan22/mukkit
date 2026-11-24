"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CUISINE_LABEL, type Cuisine } from "@/domain/cuisine";
import { TIER_MEANING, type Tier } from "@/domain/tier";
import { TierBadge } from "@/components/ui/TierBadge";
import { Memo } from "@/components/ui/Memo";
import { TierIcon } from "@/components/ui/TierIcon";
import { useLeave } from "@/lib/nav/useLeave";
import { loadNextUnrated, setTier } from "./actions";
import type { NoteVisibility, RatingVisibility, SavedPlace, UnratedCursor } from "./rating";
import { VISIBILITY, VisibilitySheet } from "./VisibilitySheet";
import { NoteVisibilityPicker } from "./NoteVisibilityPicker";
import { MetaLine } from "@/components/ui/MetaLine";

// 평가 화면 ① 과 같은 줄 — 숟가락 아이콘 배지 + 뜻 (68-4, 색 카드 넷 대신)
const RATED: Tier[] = ["three", "two", "one", "notRecommended"];

type Current = SavedPlace & { cursor: UnratedCursor };

export function QuickRate({ initial, total }: { initial: Current | null; total: number }) {
  const [place, setPlace] = useState(initial);
  const [done, setDone] = useState<Current[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  // 마지막으로 건너뛴 자리 — 다음 장소는 그 뒤에서 찾는다
  const [cursor, setCursor] = useState<UnratedCursor | null>(null);
  const [remaining, setRemaining] = useState(total);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 이번에 고른 공개 범위 — 고르기 전엔 장소마다 저장된 값 그대로 (68-4)
  const [visibility, setVisibility] = useState<RatingVisibility | null>(null);
  const [visOpen, setVisOpen] = useState(false);
  // 이 장소 메모 공개 범위 — 장소가 바뀌면 그 장소 값으로
  const [noteChoice, setNoteChoice] = useState<{ placeId: string; vis: NoteVisibility } | null>(null);
  const leave = useLeave("/my");

  function loadNext(after: UnratedCursor | null) {
    return loadNextUnrated(after).then((res) => {
      setPlace(res.place);
      setRemaining(res.remaining);
    });
  }

  function rate(tier: Tier) {
    if (!place) return;
    const current = place;
    startTransition(async () => {
      const noteVisibility = noteChoice?.placeId === current.placeId ? noteChoice.vis : undefined;
      const res = await setTier(current.placeId, tier, { visibility: visibility ?? undefined, noteVisibility });
      if (res.error) return setError(res.error);
      setError(null);
      setDone((d) => [...d, current]);
      await loadNext(cursor);
    });
  }

  function skip() {
    if (!place) return;
    setSkipped((s) => [...s, place.placeId]);
    setCursor(place.cursor);
    startTransition(() => loadNext(place.cursor));
  }

  function undo() {
    const last = done.at(-1);
    if (!last) return;
    startTransition(async () => {
      // 평가하며 바꾼 공개 범위 · 메모 공개 범위도 원래대로 — 남은 값이 다시 평가할 때 묻지 않고 나가지 않게
      const res = await setTier(last.placeId, "unrated", { visibility: last.visibility, noteVisibility: last.noteVisibility });
      if (res.error) return setError(res.error);
      setError(null);
      setNoteChoice(null);
      setDone((d) => d.slice(0, -1));
      setRemaining((r) => r + 1);
      setPlace(last);
    });
  }

  function retrySkipped() {
    setSkipped([]);
    setCursor(null);
    startTransition(() => loadNext(null));
  }

  const nothing = skipped.length === 0 && done.length === 0;
  // 이번에 평가한 수 대 아직 남은 평가 전 — 건너뛴 곳은 남은 쪽에 그대로 있다
  const scale = done.length + remaining;
  const shownVisibility = visibility ?? place?.visibility ?? "private";
  const noteVis: NoteVisibility = place ? (noteChoice?.placeId === place.placeId ? noteChoice.vis : place.noteVisibility) : "same";

  return (
    <div className="flex flex-1 flex-col">
      <div className={`flex flex-col gap-2 px-5 pt-1 ${scale === 0 ? "hidden" : ""}`}>
        <div className="flex justify-between text-meta text-muted">
          <span>
            <b className="text-ink">{done.length}곳</b> 평가
          </span>
          <span>{remaining}곳 남음</span>
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

      <p role="status" className="sr-only">
        {place ? `${place.name}, ${remaining}곳 남음` : ""}
      </p>
      {place ? (
        <>
          {/* 장소가 바뀔 때마다 아래에서 올라오게 — 약속 · 평가 화면과 같은 움직임 */}
          <section key={place.placeId} className={`meet-rise flex flex-1 flex-col px-5 pt-6 ${pending ? "opacity-60" : ""}`}>
            <MetaLine items={placeMeta(place)} />
            <h2 className="pt-0.5 text-[22px] leading-snug font-bold tracking-tight">{place.name}</h2>
            {place.note && (
              <div className="mt-3 flex flex-col gap-2.5 rounded-[12px] bg-surface px-3.5 py-3">
                <Memo tone="white" text={place.note} source={place.noteSource} />
                <NoteVisibilityPicker onSurface value={noteVis} onChange={(v) => setNoteChoice({ placeId: place.placeId, vis: v })} rating={shownVisibility} />
              </div>
            )}

            <h3 className="pt-7 pb-3 text-body font-bold">어땠어요?</h3>
            <div className="flex flex-col gap-2">
              {RATED.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={pending}
                  onClick={() => rate(t)}
                  className="flex min-h-14 items-center gap-3 rounded-[14px] border border-line px-3.5 py-2 text-left active:bg-surface disabled:opacity-60"
                >
                  <span className="w-[92px] shrink-0">
                    <TierBadge tier={t} />
                  </span>
                  <span className="flex-1 text-meta text-ink-2">{TIER_MEANING[t]}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 border-t border-line pt-1">
              <button type="button" disabled={pending} onClick={() => rate("wantToGo")} className="flex min-h-12 w-full items-center justify-between text-body disabled:opacity-60">
                <span className="text-ink-2">아직 안 가 봤어요</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold">
                  <TierIcon tier="wantToGo" height={13} color="currentColor" />
                  가고 싶은 곳으로
                </span>
              </button>
            </div>
            {error && (
              <p role="alert" className="text-meta text-danger">
                {error}
              </p>
            )}
          </section>

          <div className="sticky bottom-0 z-10 flex flex-col border-t border-line bg-white px-5 pt-1 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button type="button" onClick={() => setVisOpen(true)} aria-label={`공개 범위 바꾸기, 지금 ${VISIBILITY[shownVisibility].label}`} className="flex h-10 items-center justify-center gap-1.5 text-meta text-ink-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              공개 범위 <b className="font-semibold text-ink">{VISIBILITY[shownVisibility].label}</b>
              <span className="text-muted underline underline-offset-[3px]">바꾸기</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={undo}
                disabled={pending || done.length === 0}
                className="flex h-btn-m items-center justify-center gap-1 rounded-btn-m bg-surface text-meta font-semibold text-ink-2 disabled:opacity-40"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 14L4 9l5-5" />
                  <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
                </svg>
                되돌리기
              </button>
              <button type="button" onClick={skip} disabled={pending} className="h-btn-m rounded-btn-m bg-surface text-meta font-semibold text-ink-2 disabled:opacity-40">
                건너뛰기
              </button>
            </div>
          </div>
        </>
      ) : (
        <section className="flex flex-1 flex-col gap-3 px-5 pt-16 text-center">
          {/* 처음부터 비었으면 다 끝낸 것처럼 보이지 않게 체크를 빼고 가져오기로 잇는다 */}
          {!nothing && (
            <span aria-hidden="true" className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </span>
          )}
          <h2 className="text-title font-bold tracking-tight">
            {skipped.length > 0 ? `건너뛴 ${skipped.length}곳이 남았어요` : done.length > 0 ? `${done.length}곳을 평가했어요` : "평가 전인 곳이 없어요"}
          </h2>
          <p className="text-body leading-normal text-ink-2">
            {skipped.length > 0 ? "다시 보거나 나중에 이어서 할 수 있어요." : "장소를 가져오면 여기서 이어서 평가할 수 있어요."}
          </p>
          <div className="flex-1" />
          <div className="sticky bottom-0 z-10 flex flex-col gap-2 bg-white pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
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
            {nothing ? (
              <>
                <Link href="/import" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
                  저장한 맛집 가져오기
                </Link>
                <button type="button" onClick={leave} className="h-btn-l text-[16px] font-semibold text-ink-2">
                  닫기
                </button>
              </>
            ) : (
              <button type="button" onClick={leave} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
                완료
              </button>
            )}
          </div>
        </section>
      )}
      {visOpen && (
        <VisibilitySheet
          noteVis={place?.note ? noteVis : undefined}
          value={shownVisibility}
          onPick={(v) => {
            setVisibility(v);
            setVisOpen(false);
          }}
          onClose={() => setVisOpen(false)}
        />
      )}
    </div>
  );
}

function placeMeta(place: SavedPlace): string[] {
  const region = place.address.split(" ").slice(0, 2).join(" ");
  const cuisine = CUISINE_LABEL[place.cuisine as Cuisine];
  return [...new Set([cuisine, place.categoryName, region])].filter(Boolean);
}
