import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BottomNav } from "@/components/BottomNav";
import { NICKNAME_SETUP, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { FollowingNew, RecentLists, SimilarPeople } from "@/features/home/HomeSections";
import { needsAgreement } from "@/features/legal/legal";
import { NearbyWantToGo } from "@/features/home/NearbyWantToGo";
import { getFeed, getFollowCounts, getMyWantToGoPoints, getRecentPublicLists, getTasteMatches } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 홈 — 시안 1: 근처 가고 싶은 곳 · 팔로잉 새 평가 · 취향이 비슷한 사람 · 요즘 공개된 리스트
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="tab" title="마이슐랭" right={
          <Link href="/people" aria-label="사람 찾기" className="flex size-11 items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <circle cx="10" cy="8" r="4" />
              <path d="M3 20c.8-3.5 3.6-5.5 7-5.5M15.5 15.5a3 3 0 1 0 4.2 4.2 3 3 0 0 0-4.2-4.2zM19.7 19.7L21 21" />
            </svg>
          </Link>
        } />
      <main className="flex flex-1 flex-col gap-6 pt-1 pb-8">
        <Suspense fallback={<ListSkeleton hero />}>
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
  const { data: profile } = await supabase.from("profiles").select("nickname_set_at, terms_version").eq("id", me).single();
  if (profile && !profile.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=/home`);
  if (needsAgreement(profile)) redirect("/onboarding/terms?next=/home");

  const [wantToGo, feed, matches, lists, counts] = await Promise.all([
    getMyWantToGoPoints(supabase, me),
    getFeed(supabase),
    getTasteMatches(supabase, 8),
    getRecentPublicLists(supabase, 4),
    getFollowCounts(supabase, me),
  ]);

  return (
    <>
      <section className="mx-5 flex flex-col overflow-hidden rounded-[20px] bg-brand-soft">
        <Link href="/eat" className="flex items-center justify-between gap-3 px-5 pt-5 pb-4">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[20px] font-bold tracking-tight">여기서 뭐 먹지?</span>
            <span className="text-meta text-ink-2">내 기록과 팔로잉 평가에서 골라요</span>
          </span>
          <span className="flex h-10 shrink-0 items-center rounded-full bg-brand px-4 text-meta font-bold text-white">찾아보기</span>
        </Link>
        <NearbyWantToGo points={wantToGo} />
      </section>
      <FollowingNew ratings={feed.slice(0, 10)} followingCount={counts.following} />
      <SimilarPeople matches={matches} />
      <RecentLists lists={lists} />
    </>
  );
}
