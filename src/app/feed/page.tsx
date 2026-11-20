import Link from "next/link";
import { Suspense } from "react";
import { RatingCard } from "@/features/social/RatingCard";
import { getFeed } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "팔로잉 새 평가" };

export default function FeedPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/home" aria-label="홈으로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">팔로잉 새 평가</h1>
        <span />
      </header>
      <Suspense fallback={null}>
        <Feed />
      </Suspense>
    </main>
  );
}

async function Feed() {
  const feed = await getFeed(await createSupabaseServerClient());
  if (feed.length === 0) return <p className="py-16 text-center text-meta text-muted">팔로우한 사람의 평가가 아직 없어요.</p>;
  return (
    <div className="px-5">
      {feed.map((r) => (
        <RatingCard key={`${r.ownerId}:${r.placeId}`} rating={r} showOwner />
      ))}
    </div>
  );
}
