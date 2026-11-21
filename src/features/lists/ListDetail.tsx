"use client";

import { useLeave } from "@/lib/nav/useLeave";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { Toast } from "@/components/ui/Toast";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { addPlacesToList, removeList, removePlacesFromList, restorePlacesToList, saveListInfo, setListVisibility } from "./actions";
import type { RemovedItem } from "./lists";
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
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [undo, setUndo] = useState<{ name: string; items: RemovedItem[] } | null>(null);

  const inList = new Set(list.placeIds);
  const items = list.placeIds.flatMap((id) => places.filter((p) => p.placeId === id));

  const leave = useLeave("/lists");
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
            className="h-btn-l rounded-btn-l bg-brand text-body font-bold text-white disabled:opacity-40 raised-brand"
          >
            {picked.size}곳 추가
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
              autoFocus
              className="h-12 min-w-0 flex-1 rounded-btn-m border border-line-strong px-3.5 text-body outline-none focus:border-ink"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => saveListInfo(list.id, name, list.description), () => setEditing(false))}
              className="h-12 shrink-0 rounded-btn-m bg-ink px-4 text-body font-bold text-white raised"
            >
              저장
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <h2 className="min-w-0 truncate text-title font-bold tracking-tight">{list.name}</h2>
            <button type="button" onClick={() => setEditing(true)} aria-label="이름 바꾸기" className="flex size-9 shrink-0 items-center justify-center text-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 text-meta text-muted">
          <span>{list.count}곳</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setVisibilityOpen((v) => !v)}
            aria-expanded={visibilityOpen}
            className="flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 font-medium text-ink-2"
          >
            {VISIBILITY_LABEL[list.visibility]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
        {visibilityOpen && (
          <div role="radiogroup" aria-label="공개 범위" className="flex flex-col overflow-hidden rounded-[16px] border border-line">
            {VISIBILITIES.map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={list.visibility === v}
                disabled={pending}
                onClick={() => act(() => setListVisibility(list.id, v), () => setVisibilityOpen(false))}
                className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 text-left last:border-b-0"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-body font-semibold">{v === "link" ? "링크 공유" : VISIBILITY_LABEL[v]}</span>
                  <span className="text-meta text-muted">{VISIBILITY_HINT[v]}</span>
                </span>
                {list.visibility === v && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-brand" aria-hidden="true">
                    <path d="M5 12l5 5 9-10" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {list.visibility !== "private" && <ShareBox url={`${origin}/l/${list.id}`} name={list.name} />}

      <div className="grid grid-cols-2 gap-2">
        <Link href={`/map?list=${list.id}`} className="flex h-btn-m items-center justify-center gap-1.5 rounded-btn-m bg-surface text-body font-medium text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />
          </svg>
          지도로 보기
        </Link>
        <button type="button" onClick={() => setAdding(true)} className="h-btn-m rounded-btn-m bg-brand-soft text-body font-bold text-brand">
          장소 추가
        </button>
      </div>

      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}

      <section className="flex flex-col">
        {items.length > 0 && (
          <div className="flex items-center justify-between">
            <h3 className="text-meta font-bold text-muted">담은 곳</h3>
            <button type="button" onClick={() => setRemoving((v) => !v)} className="flex h-9 items-center text-meta font-medium text-ink-2">
              {removing ? "완료" : "편집"}
            </button>
          </div>
        )}
        <ul className="flex flex-col">
          {items.length === 0 && <li className="py-10 text-center text-meta text-muted">아직 담은 곳이 없어요</li>}
          {items.map((p, i) => (
            <li key={p.placeId}>
              <PlaceRow
                index={i + 1}
                href={`/p/${p.placeId}`}
                name={p.name}
                cuisine={p.cuisine}
                tier={p.tier}
                meta={[CUISINE_LABEL[p.cuisine], p.address.split(" ").slice(0, 2).join(" ")].filter(Boolean).join(" · ")}
                action={
                  removing && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await removePlacesFromList(list.id, [p.placeId]);
                      if (res.error) return setError(res.error);
                      setError(null);
                      setUndo({ name: p.name, items: res.removed ?? [] });
                      router.refresh();
                    })
                  }
                  aria-label={`${p.name} 삭제`}
                  className="flex h-8 shrink-0 items-center rounded-full bg-surface px-3 text-meta font-medium text-danger"
                >
                  삭제
                </button>
                  )
                }
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col items-center gap-2 pt-2">
        {confirmDelete ? (
          <div className="flex w-full flex-col gap-2 rounded-btn-l bg-surface p-4">
            <span className="text-body font-bold">리스트를 삭제할까요?</span>
            <span className="text-meta text-muted">저장한 곳과 평가는 그대로 남아요.</span>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button type="button" onClick={() => setConfirmDelete(false)} className="h-btn-m rounded-btn-m border border-line-strong bg-white text-body">
                취소
              </button>
              <button type="button" disabled={pending} onClick={() => act(() => removeList(list.id), leave)} className="h-btn-m rounded-btn-m bg-danger text-body font-bold text-white">
                삭제
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmDelete(true)} className="h-btn-m text-meta text-muted underline underline-offset-[3px]">
            리스트 삭제
          </button>
        )}
      </div>

      {undo && (
        <Toast
          message={`${undo.name} 삭제됨`}
          action="되돌리기"
          onAction={() => act(() => restorePlacesToList(list.id, undo.items), () => setUndo(null))}
          onClose={() => setUndo(null)}
        />
      )}
    </div>
  );
}

const VISIBILITY_HINT: Record<(typeof VISIBILITIES)[number], string> = {
  private: "나만 볼 수 있어요",
  link: "링크를 받은 사람만 볼 수 있어요",
  public: "누구나 볼 수 있어요. 메모는 나만 봐요",
};

// 공유 하나로 — 휴대폰이면 시스템 공유 창, 아니면 링크 복사. 미리보기는 옆에 작게
function ShareBox({ url, name }: { url: string; name: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  async function share() {
    if (canShare) return navigator.share({ title: name, url }).catch(() => undefined);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요");
    } catch {
      setMessage("복사하지 못했어요. 미리보기에서 주소를 복사해 주세요.");
    }
    setTimeout(() => setMessage(null), 2500);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button type="button" onClick={share} className="flex h-btn-m flex-1 items-center justify-center gap-1.5 rounded-btn-m bg-surface text-body font-semibold text-ink">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6" />
          </svg>
          {canShare ? "공유하기" : "링크 복사"}
        </button>
        <a href={url} target="_blank" rel="noreferrer" className="flex h-btn-m shrink-0 items-center px-3 text-meta font-medium text-muted">
          미리보기
        </a>
      </div>
      {message && (
        <p role="status" className="text-meta text-muted">
          {message}
        </p>
      )}
    </div>
  );
}

// 하이드레이션 뒤 한 번 다시 읽게 — 서버에는 주소가 없다
const noSubscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => undefined;
};
