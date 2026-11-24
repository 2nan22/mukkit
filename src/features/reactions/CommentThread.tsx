"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { SafetyMenu } from "@/features/safety/SafetyMenu";
import { deleteComment, loadComments } from "./actions";
import { CommentForm } from "./CommentForm";
import type { RatingComment } from "./reactions";

function timeLabel(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "방금";
  if (diff < 60) return `${Math.floor(diff)}분 전`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}시간 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 한 평가의 댓글 목록 + 입력 — 댓글 화면과 댓글 시트가 같이 쓴다
// top: 목록 위에 함께 스크롤할 내용 (댓글 화면의 평가 카드) · onCount: 개수가 바뀌면 알림
export function CommentThread({
  ownerId,
  placeId,
  initial,
  viewerIsOwner,
  top = null,
  hideTitle = false,
  onCount,
}: {
  ownerId: string;
  placeId: string;
  initial: RatingComment[];
  viewerIsOwner: boolean;
  top?: ReactNode;
  // 시트처럼 머리에 이미 '댓글 N'이 있으면 제목은 화면 낭독용으로만
  hideTitle?: boolean;
  onCount?: (n: number) => void;
}) {
  const [comments, setComments] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const scroll = useRef<HTMLDivElement>(null);

  async function reload(toBottom: boolean) {
    const res = await loadComments({ ownerId, placeId });
    if (res.error) return setError(res.error);
    setError(null);
    setComments(res.comments);
    onCount?.(res.comments.length);
    if (toBottom) setAnnounce("댓글을 남겼어요");
    if (toBottom) requestAnimationFrame(() => scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5">
        {top}
        <section aria-labelledby={`comments-${placeId}-${ownerId}`} className="flex flex-col pt-3 pb-4">
          <h2 id={`comments-${placeId}-${ownerId}`} className={hideTitle ? "sr-only" : "text-meta font-bold"}>
            댓글 {comments.length > 0 ? comments.length : ""}
          </h2>
          <p role="status" className="sr-only">
            {announce}
          </p>
          {error && (
            <p role="alert" className="pt-2 text-meta text-danger">
              {error}
            </p>
          )}
          {comments.length === 0 ? (
            <p className="py-10 text-center text-meta text-muted">{viewerIsOwner ? "아직 댓글이 없어요" : "첫 댓글을 남겨 보세요"}</p>
          ) : (
            <ul className="flex flex-col">
              {comments.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5 py-3">
                  <Link href={`/u/${c.authorId}`} aria-label={`${c.nickname} 프로필`} className="shrink-0 pt-0.5">
                    <Avatar name={c.nickname} size={32} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-meta">
                      <Link href={`/u/${c.authorId}`} className="font-bold">
                        {c.nickname}
                      </Link>
                      {c.authorId === ownerId && <span className="rounded bg-surface px-1.5 py-0.5 text-caption text-ink-2">글쓴이</span>}
                      <span className="text-muted" suppressHydrationWarning>
                        {timeLabel(c.createdAt)}
                      </span>
                    </span>
                    <p className="text-body leading-normal break-words whitespace-pre-line text-ink">{c.body}</p>
                  </div>
                  {(c.canDelete || !c.mine) && (
                    <div className="-mt-2">
                      <SafetyMenu
                        userId={c.authorId}
                        nickname={c.nickname}
                        commentId={c.id}
                        onDelete={
                          c.canDelete
                            ? async () => {
                                const res = await deleteComment(c.id);
                                if (!res.error) await reload(false);
                                return res;
                              }
                            : undefined
                        }
                        selfOnly={c.mine}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <CommentForm ownerId={ownerId} placeId={placeId} onPosted={() => reload(true)} />
    </div>
  );
}
