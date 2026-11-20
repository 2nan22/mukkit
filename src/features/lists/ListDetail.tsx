"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { addPlacesToList, removeList, removePlacesFromList, saveListInfo, setListVisibility } from "./actions";
import { LIST_NAME_MAX, VISIBILITIES, VISIBILITY_LABEL, type ListSummary } from "./lists";
import { PlacePicker } from "./PlacePicker";
import type { PickablePlace } from "./pickablePlaces";

type Props = { list: ListSummary & { placeIds: string[] }; places: PickablePlace[]; origin: string };

export function ListDetail({ list, places, origin }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [name, setName] = useState(list.name);

  const inList = new Set(list.placeIds);
  const items = list.placeIds.flatMap((id) => places.filter((p) => p.placeId === id));

  function act(fn: () => Promise<{ error?: string }>, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (res?.error) return setError(res.error);
      setError(null);
      after?.();
      router.refresh();
    });
  }

  if (adding) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PlacePicker places={places} selected={picked} onChange={setPicked} exclude={inList} />
        <div className="grid grid-cols-2 gap-2 border-t border-line px-5 pt-3 pb-5">
          <button type="button" onClick={() => setAdding(false)} className="h-btn-l rounded-btn-l border border-line-strong text-body text-ink">
            취소
          </button>
          <button
            type="button"
            disabled={pending || picked.size === 0}
            onClick={() => act(() => addPlacesToList(list.id, [...picked]), () => { setPicked(new Set()); setAdding(false); })}
            className="h-btn-l rounded-btn-l bg-ink text-body font-bold text-white disabled:opacity-40"
          >
            {picked.size}곳 넣기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-8">
      <section className="flex flex-col gap-2">
        {editing ? (
          <div className="flex gap-2">
            <label htmlFor="list-name" className="sr-only">
              리스트 이름
            </label>
            <input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={LIST_NAME_MAX}
              className="h-12 min-w-0 flex-1 rounded-btn-m border border-line-strong px-3.5 text-body outline-none focus:border-ink"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => saveListInfo(list.id, name, list.description), () => setEditing(false))}
              className="h-12 shrink-0 rounded-btn-m bg-ink px-4 text-body font-bold text-white"
            >
              저장
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <h2 className="min-w-0 truncate text-title font-bold tracking-tight">{list.name}</h2>
            <button type="button" onClick={() => setEditing(true)} className="h-btn-m shrink-0 text-meta text-ink-2 underline underline-offset-[3px]">
              이름 바꾸기
            </button>
          </div>
        )}
        <span className="text-meta text-muted">{list.count}곳</span>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-meta font-bold text-muted">공개 범위</h3>
        <div role="radiogroup" aria-label="공개 범위" className="grid grid-cols-3 gap-1 rounded-btn-l bg-surface-2 p-1">
          {VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={list.visibility === v}
              disabled={pending}
              onClick={() => act(() => setListVisibility(list.id, v))}
              className={`h-9 rounded-btn-s text-meta ${list.visibility === v ? "bg-white font-bold text-ink shadow-float" : "text-muted"}`}
            >
              {v === "link" ? "링크 공유" : VISIBILITY_LABEL[v]}
            </button>
          ))}
        </div>
        <span className="text-meta text-muted">
          {list.visibility === "private"
            ? "나만 볼 수 있어요."
            : list.visibility === "link"
              ? "링크가 있는 사람만 볼 수 있어요. 공유 화면은 다음에 붙어요."
              : "누구나 볼 수 있어요. 메모는 공개 리스트에서도 나만 보여요."}
        </span>
      </section>

      {list.visibility !== "private" && <ShareBox url={`${origin}/l/${list.id}`} name={list.name} />}

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/map?list=${list.id}`} className="flex h-btn-m items-center justify-center rounded-btn-m border border-line-strong text-body text-ink">
          지도로 보기
        </Link>
        <button type="button" onClick={() => setAdding(true)} className="h-btn-m rounded-btn-m bg-ink text-body font-bold text-white">
          장소 넣기
        </button>
      </div>

      {error && (
        <p role="alert" className="text-meta text-[#c4320a]">
          {error}
        </p>
      )}

      <ul className="flex flex-col">
        {items.length === 0 && <li className="py-6 text-center text-meta text-muted">아직 담은 곳이 없어요. 장소 넣기로 골라 보세요.</li>}
        {items.map((p) => (
          <li key={p.placeId} className="flex min-h-16 items-center gap-3 border-b border-line py-2">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-body">{p.name}</span>
                <TierBadge tier={p.tier} />
              </span>
              <span className="truncate text-meta text-muted">
                {[CUISINE_LABEL[p.cuisine], p.address.split(" ").slice(0, 2).join(" ")].filter(Boolean).join(" · ")}
              </span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => removePlacesFromList(list.id, [p.placeId]))}
              aria-label={`${p.name} 빼기`}
              className="flex size-11 shrink-0 items-center justify-center text-muted"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-center gap-2 pt-2">
        {confirmDelete ? (
          <div className="flex w-full flex-col gap-2 rounded-btn-l bg-surface p-4">
            <span className="text-body font-bold">리스트를 지울까요?</span>
            <span className="text-meta text-muted">담긴 장소와 평가는 그대로 남아요. 리스트만 지워져요.</span>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-btn-m rounded-btn-m border border-line-strong bg-white text-body">
                취소
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => removeList(list.id))} className="h-btn-m rounded-btn-m bg-[#c4320a] text-body font-bold text-white">
                지우기
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="h-btn-m text-meta text-muted underline underline-offset-[3px]">
            리스트 지우기
          </button>
        )}
      </div>
    </div>
  );
}

// 링크 복사는 언제나, 휴대폰이면 시스템 공유 창(카카오톡 등)도
function ShareBox({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-btn-l border border-line p-4">
      <h3 className="text-meta font-bold">공유 링크</h3>
      <input readOnly value={url} aria-label="공유 링크" onFocus={(e) => e.currentTarget.select()} className="h-10 rounded-btn-s bg-surface px-3 text-meta text-ink-2 outline-none" />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={copy} className="h-btn-m rounded-btn-m border border-line-strong text-body text-ink">
          {copied ? "복사했어요" : "링크 복사"}
        </button>
        {canShare ? (
          <button type="button" onClick={() => navigator.share({ title: name, url }).catch(() => undefined)} className="h-btn-m rounded-btn-m bg-ink text-body font-bold text-white">
            공유하기
          </button>
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="flex h-btn-m items-center justify-center rounded-btn-m bg-ink text-body font-bold text-white">
            받는 사람 화면 보기
          </a>
        )}
      </div>
    </section>
  );
}

// 하이드레이션 뒤 한 번 다시 읽게 — 서버에는 주소가 없다
const noSubscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => undefined;
};
