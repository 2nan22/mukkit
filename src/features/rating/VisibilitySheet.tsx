"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RATING_VISIBILITIES, type NoteVisibility, type RatingVisibility } from "./rating";

export const VISIBILITY: Record<RatingVisibility, { label: string; desc: string }> = {
  private: { label: "나만", desc: "등급, 한 줄 평가, 사진, 메모 모두 나만" },
  followers: { label: "팔로워", desc: "나를 팔로우하는 사람 피드에" },
  public: { label: "전체 공개", desc: "프로필과 공유 리스트에서 누구나" },
};

// 누가 볼 수 있어요? — 저장 버튼 위 한 줄에서 여는 시트 · noteVis: 메모가 있으면 메모 공개 범위
export function VisibilitySheet({ value, onPick, onClose, noteVis }: { value: RatingVisibility; onPick: (v: RatingVisibility) => void; onClose: () => void; noteVis?: NoteVisibility }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => sheet.current?.focus(), []);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={onClose}>
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vis-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex w-full max-w-[480px] flex-col gap-2 rounded-t-[20px] bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none"
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
        <h2 id="vis-title" className="pt-2 text-section font-bold">
          누가 볼 수 있어요?
        </h2>
        {noteVis !== undefined && <p className="text-meta text-muted">{noteVis === "same" ? "메모도 이 범위대로 보여요" : `메모는 ‘${VISIBILITY[noteVis].label}’${noteVis === "private" ? "으로" : "로"} 따로 정했어요`}</p>}
        <div role="radiogroup" aria-labelledby="vis-title" className="flex flex-col gap-1.5 pt-1">
          {RATING_VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              onClick={() => onPick(v)}
              className={`flex min-h-14 items-center justify-between gap-3 rounded-[12px] border px-4 text-left ${value === v ? "border-[1.5px] border-ink" : "border-line"}`}
            >
              <span className="flex flex-col">
                <span className="text-body font-semibold">{VISIBILITY[v].label}</span>
                <span className="text-meta text-muted">{VISIBILITY[v].desc}</span>
              </span>
              <span aria-hidden="true" className={`size-5 shrink-0 rounded-full ${value === v ? "border-[6px] border-ink" : "border-[1.5px] border-line-strong"}`} />
            </button>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
