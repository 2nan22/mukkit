import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BottomNav } from "@/components/BottomNav";
import { NICKNAME_SETUP, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { FollowingNew, RecentLists, SimilarPeople } from "@/features/home/HomeSections";
import { NearbyWantToGo } from "@/features/home/NearbyWantToGo";
import { getFeed, getMyWantToGoPoints, getRecentPublicLists, getTasteMatches } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 홈 — 시안 1: 근처 가고 싶은 곳 · 팔로잉 새 평가 · 취향이 비슷한 사람 · 요즘 공개된 리스트
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between pr-2 pl-5">
        <span className="text-section font-bold tracking-tight">마이슐랭</span>
        <Link href="/people" aria-label="사람 찾기" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </Link>
      </header>
      <main className="flex flex-1 flex-col gap-6 pt-1 pb-8">
        <Suspense fallback={null}>
          <HomeContent />
        </Suspense>
      </main>
      <div className="sticky bottom-0">
        <BottomNav />
      </div>
    </div>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function HomeContent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const { data: profile } = await supabase.from("profiles").select("nickname_set_at").eq("id", me).single();
  if (profile && !profile.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=/home`);

  const [wantToGo, feed, matches, lists] = await Promise.all([
    getMyWantToGoPoints(supabase, me),
    getFeed(supabase),
    getTasteMatches(supabase, 8),
    getRecentPublicLists(supabase, 4),
  ]);

  return (
    <>
      <NearbyWantToGo points={wantToGo} />
      <FollowingNew ratings={feed.slice(0, 10)} />
      <SimilarPeople matches={matches} />
      <RecentLists lists={lists} />
    </>
  );
}
