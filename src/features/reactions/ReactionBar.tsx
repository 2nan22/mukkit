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

  const heart = (filled: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
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
            {heart(liked)}
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
            {/* 내 평가는 하트가 없어 아이콘만 뜨면 뭔지 모른다 — 글자를 붙인다 */}
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
