"use client";

import { useEffect, useRef, useState } from "react";
import { loadComments } from "./actions";
import { CommentThread } from "./CommentThread";
import type { RatingComment } from "./reactions";

// 카드에서 여는 댓글 시트 — 페이지를 넘기지 않고 보고 쓴다. 닫으면 보던 자리 그대로
export function CommentsSheet({
  ownerId,
  placeId,
  viewerIsOwner,
  onClose,
  onCount,
}: {
  ownerId: string;
  placeId: string;
  viewerIsOwner: boolean;
  onClose: () => void;
  onCount: (n: number) => void;
}) {
  const [comments, setComments] = useState<RatingComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);
  // 키보드가 올라오면 보이는 영역(visualViewport)에 맞춘다 — iOS 는 dvh 가 줄지 않는다
  const [vv, setVv] = useState<{ h: number; top: number } | null>(null);
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    const fit = () => setVv({ h: view.height, top: view.offsetTop });
    fit();
    view.addEventListener("resize", fit);
    view.addEventListener("scroll", fit);
    return () => {
      view.removeEventListener("resize", fit);
      view.removeEventListener("scroll", fit);
    };
  }, []);

  useEffect(() => {
    // 닫히면 연 버튼으로 포커스를 돌려준다
    const opener = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    loadComments({ ownerId, placeId }).then((res) => {
      if (res.error) return setError(res.error);
      setComments(res.comments);
      setCount(res.comments.length);
    });
    // 뒤 화면 스크롤 잠금
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      opener?.focus();
    };
  }, [ownerId, placeId]);

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 flex items-end justify-center bg-black/30 ${vv ? "" : "h-dvh"}`}
      style={vv ? { height: vv.h, transform: `translateY(${vv.top}px)` } : undefined}
      onClick={onClose}
    >
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="댓글"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex h-[min(85dvh,100%)] w-full max-w-[480px] flex-col rounded-t-[20px] bg-white outline-none"
      >
        <div className="relative flex h-13 shrink-0 items-center justify-center border-b border-line">
          <span className="text-body font-bold">댓글{count ? ` ${count}` : ""}</span>
          <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-1 right-2 flex size-11 items-center justify-center text-ink">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {comments ? (
          <CommentThread
            ownerId={ownerId}
            placeId={placeId}
            initial={comments}
            viewerIsOwner={viewerIsOwner}
            hideTitle
            onCount={(n) => {
              setCount(n);
              onCount(n);
            }}
          />
        ) : (
          <p role={error ? "alert" : "status"} className={`py-10 text-center text-meta ${error ? "text-danger" : "text-muted"}`}>
            {error ?? "댓글을 불러오는 중"}
          </p>
        )}
      </section>
    </div>
  );
}
