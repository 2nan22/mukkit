"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { placeInThree, saveThreeOrder } from "./actions";
import { RankedList } from "./RankedList";
import { CompareSheet } from "./CompareSheet";
import type { RankPlace } from "./rank";

const meta = (p: RankPlace) => [CUISINE_LABEL[p.cuisine], regionOf(p.address)].filter(Boolean).join(" · ");

// 내 3스타 순위 — 정한 곳은 순서대로, 안 정한 곳은 비교해서 넣기 · 정한 곳도 다시 비교 가능
export function RankBoard({ ranked: initialRanked, unranked: initialUnranked }: { ranked: RankPlace[]; unranked: RankPlace[] }) {
  // 비교 결과를 바로 반영 — 이어서 정할 때 새로 고침을 기다리지 않는다
  const [ranked, setRanked] = useState(initialRanked);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const unranked = initialUnranked.filter((u) => !doneIds.includes(u.placeId));
  const router = useRouter();
  const [comparing, setComparing] = useState<RankPlace | null>(null);
  // 하나씩 정하기 — 끝나면 다음 안 정한 곳으로 이어 간다 ('나중에 할게요'로 멈춤)
  const [chain, setChain] = useState(false);
  // 순서 바꾸기 편집 모드 — ≡ 로 끌어서 옮기기
  const [editing, setEditing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const FOLD = 5;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function begin(p: RankPlace, continueChain = false) {
    setError(null);
    const others = ranked.filter((r) => r.placeId !== p.placeId);
    if (others.length > 0) return setComparing(p);
    // 비교할 곳이 없으면 바로 1위
    start(async () => {
      const res = await placeInThree(p.placeId, null);
      if (res.error) return setError(res.error);
      setRanked([{ ...p, rank: 0 }]);
      setDoneIds((d) => [...d, p.placeId]);
      router.refresh();
      // 첫 곳은 비교 없이 1위 — 하나씩 정하기면 다음 곳부터 비교
      const next = continueChain ? unranked.find((u) => u.placeId !== p.placeId) : undefined;
      if (next) setComparing(next);
      else setChain(false);
    });
  }

  return (
    <div className="flex flex-col px-5 pb-10">
      {error && (
        <p role="alert" className="pt-3 text-meta text-danger">
          {error}
        </p>
      )}
      {ranked.length === 0 ? (
        <div className="flex flex-col gap-1 py-8 text-meta text-muted">
          <p>아직 순위를 정한 3스타가 없어요.</p>
          <p>아래에서 하나씩 정해 보세요.</p>
        </div>
      ) : (
        <>
          {ranked.length > 1 && (
            <div className="flex justify-end">
              <button type="button" onClick={() => setEditing((v) => !v)} aria-pressed={editing} className="h-11 text-meta font-semibold text-ink">
                {editing ? "완료" : "순서 바꾸기"}
              </button>
            </div>
          )}
          {editing && <p className="pb-1 text-meta text-muted">≡ 를 잡고 위아래로 옮기면 바로 저장돼요.</p>}
          <RankedList
            ranked={ranked}
            editing={editing}
            meta={meta}
            busy={pending}
            onRedo={(p) => begin(p)}
            onMove={(next) => {
              const before = ranked;
              setRanked(next);
              setError(null);
              start(async () => {
                const res = await saveThreeOrder(next.map((p) => p.placeId));
                if (res.error) {
                  setRanked(before);
                  setError(res.error);
                }
              });
            }}
          />
        </>
      )}
      {unranked.length > 0 && (
        <section aria-labelledby="unranked-title" className="flex flex-col pt-8">
          <div className="flex items-center justify-between gap-3">
            <h2 id="unranked-title" className="text-section font-bold">
              아직 순위 없는 3스타 {unranked.length}곳
            </h2>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setChain(true);
                begin(unranked[0], true);
              }}
              className="h-11 shrink-0 rounded-btn-s bg-ink px-3.5 text-meta font-bold text-white disabled:opacity-50"
            >
              하나씩 정하기
            </button>
          </div>
          <ul className="flex flex-col">
            {(showAll ? unranked : unranked.slice(0, FOLD)).map((p) => (
              <li key={p.placeId} className="flex min-h-16 items-center gap-3 border-b border-line">
                <Link href={`/p/${p.placeId}`} className="flex min-w-0 flex-1 flex-col gap-0.5 py-2">
                  <span className="truncate text-body font-semibold">{p.name}</span>
                  <span className="truncate text-meta text-muted">{meta(p)}</span>
                </Link>
                <button type="button" disabled={pending} onClick={() => begin(p)} aria-label={`${p.name} 순위 정하기`} className="h-11 min-w-11 shrink-0 px-2 text-meta text-ink-2">
                  정하기
                </button>
              </li>
            ))}
          </ul>
          {!showAll && unranked.length > FOLD && (
            <button type="button" onClick={() => setShowAll(true)} className="flex h-11 items-center justify-center text-meta font-semibold text-ink-2">
              {unranked.length}곳 모두 보기
            </button>
          )}
        </section>
      )}
      {comparing && (
        <CompareSheet
          key={comparing.placeId}
          target={comparing}
          ranked={ranked.filter((r) => r.placeId !== comparing.placeId)}
          label={comparing.rank === null ? "순위 정할 곳" : "다시 정할 곳"}
          cancelLabel={chain ? "그만하기" : comparing.rank === null ? "나중에 할게요" : "취소"}
          remaining={chain ? unranked.filter((u) => u.placeId !== comparing.placeId).length : 0}
          onDone={(res, goNext) => {
            setComparing(null);
            if (!res) return setChain(false);
            const rest = ranked.filter((r) => r.placeId !== comparing.placeId);
            rest.splice(res.rank - 1, 0, { ...comparing, rank: res.rank - 1 });
            setRanked(rest);
            setDoneIds((d) => [...d, comparing.placeId]);
            router.refresh();
            // 이어서 — 방금 정한 곳을 뺀 다음 안 정한 곳
            const next = chain && goNext ? unranked.find((u) => u.placeId !== comparing.placeId) : undefined;
            if (next) setComparing(next);
            else setChain(false);
          }}
        />
      )}
    </div>
  );
}
