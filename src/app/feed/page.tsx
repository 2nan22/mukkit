import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getReactions, reactionKey } from "@/features/reactions/reactions";
import { RatingCard } from "@/features/social/RatingCard";
import { getFeed, getFollowCounts } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "피드" };

// 하단 탭 — 팔로우한 사람과 내 공개 · 팔로워 공개 평가 (내 것은 68-9)
export default function FeedPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="tab" title="피드" />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<ListSkeleton />}>
          <Feed />
        </Suspense>
      </main>
      <div className="sticky bottom-0 z-30">
        <BottomNav />
      </div>
    </div>
  );
}

async function Feed() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const [feed, counts] = await Promise.all([getFeed(supabase, { mine: true }), getFollowCounts(supabase, me)]);
  if (feed.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 pb-16 text-center">
        <span className="text-body font-semibold">{counts.following > 0 ? "팔로잉의 새 평가가 아직 없어요" : "아직 팔로우한 사람이 없어요"}</span>
        <span className="text-meta leading-normal text-muted">
          {counts.following > 0 ? "팔로우한 사람이 평가를 공개하면 여기에 보여요." : "취향이 비슷한 사람을 팔로우하면 그 사람의 평가가 여기에 모여요."}
        </span>
        <Link href="/people" className="mt-1 flex h-10 items-center rounded-full bg-brand-soft px-4 text-meta font-bold text-brand">
          사람 찾기
        </Link>
      </div>
    );
  }
  const reactions = await getReactions(supabase, feed);
  return (
    <div className="px-5 pb-6">
      {/* 내 평가만 있을 때 — 빈 화면 안내 대신 맨 위 한 줄 (68-9) */}
      {counts.following === 0 && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-btn-s bg-surface px-3.5 py-3">
          <span className="text-meta leading-normal text-ink-2">사람을 팔로우하면 그 사람 평가도 여기 모여요</span>
          <Link href="/people" className="shrink-0 text-meta font-bold text-brand">
            사람 찾기
          </Link>
        </div>
      )}
      {feed.map((r) => (
        <RatingCard key={`${r.ownerId}:${r.placeId}`} rating={r} showOwner viewerId={me} reaction={reactions.get(reactionKey(r.ownerId, r.placeId)) ?? null} />
      ))}
    </div>
  );
}
