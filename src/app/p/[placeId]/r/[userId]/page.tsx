import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { CommentThread } from "@/features/reactions/CommentThread";
import { getComments, getReactions, reactionKey } from "@/features/reactions/reactions";
import { RatingCard } from "@/features/social/RatingCard";
import { getRatingDetail } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "댓글" };

// 평가 하나의 댓글 — 평가를 볼 수 있는 사람만 (볼 수 없으면 없는 화면)
export default function RatingCommentsPage({ params }: PageProps<"/p/[placeId]/r/[userId]">) {
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden">
      <Suspense fallback={<ListSkeleton />}>
        <Comments params={params} />
      </Suspense>
    </div>
  );
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
      <CommentThread
        ownerId={userId}
        placeId={placeId}
        initial={comments}
        viewerIsOwner={userId === me}
        top={<RatingCard rating={rating} showOwner viewerId={me} reaction={reactions.get(reactionKey(userId, placeId)) ?? null} showComments={false} />}
      />
    </>
  );
}
