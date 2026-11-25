"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLike } from "./actions";
import { CommentsSheet } from "./CommentsSheet";
import type { Reaction } from "./reactions";

// 평가 카드 아래 — 좋아요 · 댓글 아이콘, 최근 댓글 2개, '댓글 N개 모두 보기' (인스타그램식)
// 댓글은 시트로 열어 페이지를 넘기지 않는다. 내 평가면 좋아요는 글자로만 · showComments=false 는 댓글 화면 안
export function ReactionBar({
  ownerId,
  placeId,
  reaction,
  mine,
  showComments = true,
}: {
  ownerId: string;
  placeId: string;
  reaction: Reaction;
  mine: boolean;
  showComments?: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(reaction.liked);
  const [likes, setLikes] = useState(reaction.likes);
  const [count, setCount] = useState(reaction.comments);
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function toggle() {
    const on = !liked;
    setLiked(on);
    setLikes((n) => n + (on ? 1 : -1));
    setError(null);
    start(async () => {
      const res = await setLike({ ownerId, placeId, on });
      if (res.error) {
        setLiked(!on);
        setLikes((n) => n + (on ? -1 : 1));
        setError(res.error);
      }
    });
  }
  function closeSheet() {
    setSheet(false);
    // 미리보기 · 개수를 새로 받는다
    if (count !== reaction.comments) router.refresh();
  }

  // 좋아요 아이콘은 포크와 나이프 (71, 사용자 결정 2026-11-25) — 안 누르면 선, 누르면 속이 찬 모양
  const forkKnife = (filled: boolean) =>
    filled ? (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4.5 3h1.6v5h1.6V3h1.6v5h1.6V3h1.6v5.2a4 4 0 0 1-3 3.87V20.2a1 1 0 0 1-2 0v-8.13a4 4 0 0 1-3-3.87z" />
        <path d="M18.2 3c-2.2.9-3.4 3.7-3.4 8v1h2.2v8.2a1 1 0 0 0 2 0V3.6c0-.4-.4-.7-.8-.6z" />
      </svg>
    ) : (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5.5 3v5.5a3 3 0 0 0 6 0V3M8.5 3v6M8.5 11.5V21M18 3c-2 1-3 4-3 8h3M18 3v18" />
      </svg>
    );
  const preview = showComments ? reaction.preview : [];

  return (
    <div className="flex flex-col">
      <div className="-ml-2.5 flex items-center">
        {!mine && (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={liked}
            aria-label={liked ? "좋아요 취소" : "좋아요"}
            className={`flex size-11 items-center justify-center transition-transform active:scale-90 ${liked ? "text-ink" : "text-ink-2"}`}
          >
            {forkKnife(liked)}
          </button>
        )}
        {showComments && (
          <button
            type="button"
            onClick={() => setSheet(true)}
            aria-label={mine ? undefined : count > 0 ? `댓글 ${count}개 보기` : "댓글 쓰기"}
            className={`flex h-11 items-center gap-1.5 text-ink-2 ${mine ? "px-2.5 text-meta" : "w-11 justify-center"}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v11H9l-5 4z" />
            </svg>
            {/* 내 평가는 좋아요 버튼이 없어 아이콘만 뜨면 뭔지 모른다 — 글자를 붙인다 */}
            {mine && <span>{count > 0 ? `댓글 ${count}개` : "댓글 쓰기"}</span>}
          </button>
        )}
      </div>
      {likes > 0 && <span className="text-meta font-bold">좋아요 {likes}개</span>}
      {preview.length > 0 && (
        <ul aria-label="최근 댓글" className="flex flex-col gap-0.5 pt-1">
          {preview.map((c) => (
            <li key={c.id} className="line-clamp-2 text-meta leading-normal text-ink-2">
              <span className="font-bold text-ink">{c.nickname}</span> {c.body}
            </li>
          ))}
        </ul>
      )}
      {showComments && count > preview.length && (
        <button type="button" onClick={() => setSheet(true)} className="-mb-1 flex h-11 items-center self-start text-meta text-muted">
          댓글 {count}개 모두 보기
        </button>
      )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      {sheet && <CommentsSheet ownerId={ownerId} placeId={placeId} viewerIsOwner={mine} onClose={closeSheet} onCount={setCount} />}
    </div>
  );
}
