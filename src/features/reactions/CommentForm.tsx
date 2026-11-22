"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addComment } from "./actions";

const MAX = 300;

// 댓글 쓰기 — 화면 아래 고정. 남기면 목록을 새로 받고 맨 아래로
export function CommentForm({ ownerId, placeId }: { ownerId: string; placeId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const empty = body.trim().length === 0;

  function submit() {
    if (empty || pending) return;
    setError(null);
    start(async () => {
      const res = await addComment({ ownerId, placeId, body });
      if (res.error) return setError(res.error);
      setBody("");
      router.refresh();
      requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-1 border-t border-line bg-white px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-end gap-2">
        <label htmlFor="comment-body" className="sr-only">
          댓글 쓰기
        </label>
        <textarea
          id="comment-body"
          ref={box}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          maxLength={MAX}
          rows={1}
          placeholder="댓글 남기기"
          className="min-h-11 flex-1 resize-none rounded-[12px] bg-surface px-3.5 py-2.5 text-body leading-normal outline-none focus:bg-white focus:ring-1 focus:ring-ink"
        />
        <button type="submit" disabled={empty || pending} className="h-11 shrink-0 rounded-btn-m bg-brand px-4 text-body font-bold text-white disabled:opacity-40">
          남기기
        </button>
      </div>
      {body.length > MAX - 50 && <span className="text-right text-caption text-muted">{body.length}/{MAX}</span>}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
