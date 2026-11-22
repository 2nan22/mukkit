"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setLike } from "./actions";
import { commentsHref, type Reaction } from "./reactions";

// 평가 카드 아래 — 좋아요 · 댓글. 내 평가면 좋아요 수만 보이고 누를 수 없다
// showComments=false 는 댓글 화면 안 (댓글 링크 대신 그 아래 목록)
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
  const [liked, setLiked] = useState(reaction.liked);
  const [likes, setLikes] = useState(reaction.likes);
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

  const heart = (filled: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
    </svg>
  );

  return (
    <div className="-ml-2.5 flex flex-col">
      <div className="flex items-center">
        {mine ? (
          <span className="flex h-11 items-center gap-1.5 px-2.5 text-meta text-muted" aria-label={`좋아요 ${likes}개`}>
            {heart(false)}
            {likes > 0 && <span aria-hidden="true">{likes}</span>}
          </span>
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={liked}
            aria-label={`좋아요${likes > 0 ? ` ${likes}개` : ""}`}
            className={`flex h-11 items-center gap-1.5 px-2.5 text-meta ${liked ? "font-bold text-ink" : "text-muted"}`}
          >
            {heart(liked)}
            {likes > 0 && <span aria-hidden="true">{likes}</span>}
          </button>
        )}
        {showComments && (
          <Link href={commentsHref(ownerId, placeId)} className="flex h-11 items-center gap-1.5 px-2.5 text-meta text-muted" aria-label={reaction.comments > 0 ? `댓글 ${reaction.comments}개 보기` : "댓글 쓰기"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v11H9l-5 4z" />
            </svg>
            <span aria-hidden="true">{reaction.comments > 0 ? reaction.comments : "댓글"}</span>
          </Link>
        )}
      </div>
      {error && (
        <p role="alert" className="pl-2.5 text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
