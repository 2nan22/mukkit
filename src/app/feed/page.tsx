import { AppHeader } from "@/components/AppHeader";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { RatingCard } from "@/features/social/RatingCard";
import { getFeed } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "팔로잉 새 평가" };

export default function FeedPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/home" title="팔로잉 새 평가" />
      <Suspense fallback={<ListSkeleton />}>
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
