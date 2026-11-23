import { getMyProfileFlags } from "@/features/profile/flags";
import { getPlaceCovers } from "@/features/place/covers";
import { Wordmark } from "@/components/brand/Wordmark";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BottomNav } from "@/components/BottomNav";
import {
  NICKNAME_SETUP,
  SESSION_ENDED,
  SIGNED_OUT_HOME,
} from "@/features/auth/paths";
import {
  FollowingNew,
  RecentLists,
  SimilarPeople,
} from "@/features/home/HomeSections";
import { needsAgreement } from "@/features/legal/legal";
import { NearbyWantToGo } from "@/features/home/NearbyWantToGo";
import { getMyHome } from "@/features/home/myHome";
import { MyMap, QuickRate, RankTop, RecentSaved } from "@/features/home/MyHomeSections";
import { getThreeRanking } from "@/features/rank/rank";
import { countMyTiers } from "@/features/lists/lists";
import {
  getFeed,
  getFollowCounts,
  getMyWantToGoPoints,
  getPopularPublicLists,
  getTasteMatches,
} from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 홈 — 근처 가고 싶은 곳 · 빠르게 평가 · 내 지도 · 최근 저장 · 나만의 맛집 순위 · 팔로잉 새 평가 · 취향이 비슷한 사람 · 요즘 많이 저장된 리스트 (49)
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader
        kind="tab"
        title={
          <Wordmark />
        }
        right={
          <>
            <Link
              href="/search"
              aria-label="검색"
              className="flex size-11 items-center justify-center"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
            </Link>
            <Suspense fallback={<span className="size-11" />}>
              <NotificationBell />
            </Suspense>
          </>
        }
      />
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
  // 프로필 확인과 화면 데이터를 한 번에 — 차례로 기다리지 않게 (리다이렉트면 결과는 버린다)
  const [
    profile,
    wantToGo,
    feed,
    matches,
    lists,
    counts,
    { count: visitTags },
    { count: invites },
    home,
    ranking,
    tiers,
  ] = await Promise.all([
    getMyProfileFlags(supabase),
    getMyWantToGoPoints(supabase, me),
    getFeed(supabase),
    getTasteMatches(supabase, 8),
    getPopularPublicLists(supabase, 4),
    getFollowCounts(supabase, me),
    supabase
      .from("visit_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", me)
      .eq("status", "invited"),
    supabase
      .from("meetup_invites")
      .select("meetup_id, meetups!inner(status)", {
        count: "exact",
        head: true,
      })
      .eq("user_id", me)
      .eq("meetups.status", "open"),
    getMyHome(supabase, me),
    getThreeRanking(supabase, me),
    countMyTiers(supabase, me),
  ]);
  // 리스트 카드 썸네일 — 담긴 곳의 대표 사진 (내 사진 · 팔로잉)
  // 최근 저장한 곳 사진도 한 번에
  const recentCovers = Object.fromEntries(
    [
      ...(await getPlaceCovers(supabase, [
        ...lists.flatMap((l) => l.points.map((p) => p.placeId)),
        ...home.recent.map((p) => p.placeId),
      ])),
    ].map(([id, c]) => [id, c.url]),
  );
  // 프로필이 없으면 지워진 계정의 로그인이 남은 것 — 반복 대신 로그아웃
  if (!profile) redirect(SESSION_ENDED);
  if (!profile.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=/home`);
  if (needsAgreement(profile)) redirect("/onboarding/terms?next=/home");

  return (
    <>
      <section className="mx-5 flex flex-col overflow-hidden rounded-[20px] bg-brand-soft">
        <Link
          href="/eat"
          className="flex items-center justify-between gap-3 px-5 pt-5 pb-4"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[20px] font-bold tracking-tight">
              여기서 뭐 먹지?
            </span>
            <span className="text-meta text-ink-2">
              내 기록과 팔로잉 평가에서 골라요
            </span>
          </span>
          <span className="flex h-10 shrink-0 items-center rounded-full bg-brand px-4 text-meta font-bold text-white raised-brand">
            찾아보기
          </span>
        </Link>
        <NearbyWantToGo points={wantToGo} />
        <Link
          href="/meet"
          className="flex items-center gap-3 border-t border-[#f5dccb] px-5 py-3.5"
        >
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-brand"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="8" cy="8" r="3" />
              <circle cx="16" cy="8" r="3" />
              <path d="M3 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5M11 19c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-semibold">친구와 약속 잡기</span>
            <span
              className={`text-meta ${invites ? "font-semibold text-brand" : "text-muted"}`}
            >
              {invites
                ? `받은 약속 초대 ${invites}개`
                : "모두 오가기 편한 곳을 찾아 드려요"}
            </span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </section>
      {visitTags ? (
        <Link
          href="/visits"
          className="mx-5 flex min-h-12 items-center justify-between gap-3 rounded-[16px] bg-surface px-4"
        >
          <span className="text-meta text-ink-2">
            함께 방문 요청 <b className="font-bold text-ink">{visitTags}건</b>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      ) : null}
      {/* 순서 — 할 일(평가 전) › 아는 사람의 새 평가 › 내 기록 (49 검토) */}
      <QuickRate count={tiers.unrated ?? 0} />
      <FollowingNew
        ratings={feed.slice(0, 10)}
        followingCount={counts.following}
        me={me}
      />
      <MyMap home={home} tiers={tiers} />
      <RecentSaved home={home} covers={recentCovers} />
      <RankTop ranked={ranking.ranked} unranked={ranking.unranked.length} />
      <SimilarPeople matches={matches} />
      <RecentLists lists={lists} covers={recentCovers} />
    </>
  );
}
