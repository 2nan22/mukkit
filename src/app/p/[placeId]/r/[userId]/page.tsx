import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { Avatar } from "@/components/ui/Avatar";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { deleteComment } from "@/features/reactions/actions";
import { CommentForm } from "@/features/reactions/CommentForm";
import { getComments, getReactions, reactionKey } from "@/features/reactions/reactions";
import { SafetyMenu } from "@/features/safety/SafetyMenu";
import { RatingCard } from "@/features/social/RatingCard";
import { getRatingDetail } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "댓글" };

// 평가 하나의 댓글 — 평가를 볼 수 있는 사람만 (볼 수 없으면 없는 화면)
export default function RatingCommentsPage({ params }: PageProps<"/p/[placeId]/r/[userId]">) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Suspense fallback={<ListSkeleton />}>
        <Comments params={params} />
      </Suspense>
    </div>
  );
}

function timeLabel(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "방금";
  if (diff < 60) return `${Math.floor(diff)}분 전`;
  if (diff < 60 * 24) return `${Math.floor(diff / 60)}시간 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

async function Comments({ params }: { params: Promise<{ placeId: string; userId: string }> }) {
  const { placeId, userId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(placeId) || !/^[0-9a-f-]{36}$/.test(userId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const [rating, reactions, comments] = await Promise.all([
    getRatingDetail(supabase, userId, placeId),
    getReactions(supabase, [{ ownerId: userId, placeId }]),
    getComments(supabase, userId, placeId),
  ]);
  if (!rating) notFound();

  return (
    <>
      <AppHeader kind="back" title="댓글" fallback={`/p/${placeId}`} />
      <main className="flex flex-1 flex-col px-5">
        <RatingCard rating={rating} showOwner viewerId={me} reaction={reactions.get(reactionKey(userId, placeId)) ?? null} showComments={false} />
        <section aria-label="댓글" className="flex flex-1 flex-col pb-4">
          {comments.length === 0 ? (
            <p className="py-10 text-center text-meta text-muted">첫 댓글을 남겨 보세요</p>
          ) : (
            <ul className="flex flex-col">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-2.5 py-3">
                  <Link href={`/u/${c.authorId}`} aria-label={`${c.nickname} 프로필`} className="shrink-0 pt-0.5">
                    <Avatar name={c.nickname} size={40} />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-meta">
                      <Link href={`/u/${c.authorId}`} className="font-bold">
                        {c.nickname}
                      </Link>
                      {c.authorId === userId && <span className="text-caption text-muted">작성자</span>}
                      <span className="text-muted">· {timeLabel(c.createdAt)}</span>
                    </span>
                    <p className="text-body leading-normal break-words whitespace-pre-line text-ink-2">{c.body}</p>
                  </div>
                  {(c.canDelete || !c.mine) && (
                    <SafetyMenu
                      userId={c.authorId}
                      nickname={c.nickname}
                      commentId={c.id}
                      onDelete={c.canDelete ? deleteComment.bind(null, c.id) : undefined}
                      selfOnly={c.mine}
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <div className="sticky bottom-0">
        <CommentForm ownerId={userId} placeId={placeId} />
      </div>
    </>
  );
}
