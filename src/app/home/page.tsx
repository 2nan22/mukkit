import { getMyProfileFlags } from "@/features/profile/flags";
import { recapReady, recapYear } from "@/features/recap/recap";
import { RecapBanner } from "@/features/recap/RecapBanner";
import { Wordmark } from "@/components/brand/Wordmark";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BottomNav } from "@/components/BottomNav";
import { NICKNAME_SETUP, SESSION_ENDED, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { needsAgreement } from "@/features/legal/legal";
import { ActionTiles, MatchRow, PeopleRow, RatingTile, WaitLine } from "@/features/home/HomeE2";
import { RecentLists, SimilarPeople } from "@/features/home/HomeSections";
import { MyMap, RankTop, RecentSaved } from "@/features/home/MyHomeSections";
import { getMyHome } from "@/features/home/myHome";
import { getPlaceCovers } from "@/features/place/covers";
import { getThreeRanking } from "@/features/rank/rank";
import { getHomeMeetup, homeTiles } from "@/features/home/homeMeetup";
import { countMyTiers } from "@/features/lists/lists";
import { dateLabel } from "@/features/social/RatingCard";
import { getFeed, getFollowCounts, getPopularPublicLists, getTasteMatches } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 홈 E2 (96) — 얼굴 줄 › 큰 평가 › 뭐 먹지 · 약속 두 칸 › 기다리는 일 › 새 평가 더 › 내 기록 (49 를 바꿈)
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
      <main className="flex flex-1 flex-col gap-6 pt-1 pb-10">
        <Suspense fallback={<ListSkeleton hero />}>
          <HomeContent />
        </Suspense>
      </main>
      <div className="sticky bottom-0 z-30">
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
  const requestNow = new Date(feedAsOf()).getTime();
  // 프로필 확인과 화면 데이터를 한 번에 — 차례로 기다리지 않게 (리다이렉트면 결과는 버린다)
  const [profile, feed, matches, counts, { count: visitTags }, meetup, tiers, showRecap, home, ranking, lists] = await Promise.all([
    getMyProfileFlags(supabase),
    getFeed(supabase),
    getTasteMatches(supabase, 10),
    getFollowCounts(supabase, me),
    supabase.from("visit_members").select("id", { count: "exact", head: true }).eq("user_id", me).eq("status", "invited"),
    getHomeMeetup(supabase, me, requestNow),
    countMyTiers(supabase, me),
    // 결산 철이면 알림함에도 한 줄 (해마다 한 번, 94)
    recapReady(supabase, me).then(async (ok) => {
      if (ok) await supabase.rpc("claim_recap_notice");
      return ok;
    }),
    // 아래 둘러볼 거리 (96-2, 사용자 '많이 심심해졌다') — 내 지도 · 최근 저장 · 순위 · 비슷한 사람 · 많이 저장된 리스트
    getMyHome(supabase, me),
    getThreeRanking(supabase, me),
    getPopularPublicLists(supabase, 4),
  ]);
  // 리스트 카드 · 최근 저장한 곳 사진 — 한 번에
  const covers = Object.fromEntries(
    [...(await getPlaceCovers(supabase, [...lists.flatMap((l) => l.points.map((p) => p.placeId)), ...home.recent.map((p) => p.placeId)]))].map(([id, c]) => [id, c.url]),
  );
  // 프로필이 없으면 지워진 계정의 로그인이 남은 것 — 반복 대신 로그아웃
  if (!profile) redirect(SESSION_ENDED);
  if (!profile.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=/home`);
  if (needsAgreement(profile)) redirect("/onboarding/terms?next=/home");

  // 얼굴 테두리 기준 시각 — 요청 때 한 번
  const now = requestNow;
  const saved = Object.values(tiers).reduce((n, c) => n + c, 0);
  // 저장한 곳이 하나도 없으면 첫 행동은 가져오기 — 주 버튼(주황)은 이 카드 하나로
  const empty = saved === 0;
  const tiles = homeTiles({ meetup, wantToGo: tiers.want_to_go ?? 0, empty, now });
  // 큰 칸은 사진이 있는 최근 평가 먼저, 없으면 가장 최근 평가 (사진 없는 칸은 낮게)
  const big = feed.find((r) => r.media.some((m) => m.kind === "image")) ?? feed[0] ?? null;
  const more = feed.filter((r) => r !== big).slice(0, 2);
  const date = (r: (typeof feed)[number]) => (r.visitedOn ? `${dateLabel(r.visitedOn)} 방문` : dateLabel(r.ratedAt));

  return (
    <>
      {empty && (
        <section className="mx-5 flex flex-col gap-3 rounded-[20px] border border-line p-5">
          <span className="flex flex-col gap-1">
            <span className="text-[20px] font-bold tracking-tight">저장해 둔 맛집부터 가져와요</span>
            <span className="text-meta text-ink-2">네이버 지도나 카카오맵 리스트를 붙이면 지도가 바로 채워져요</span>
          </span>
          <Link href="/import" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
            저장한 맛집 가져오기
          </Link>
        </section>
      )}
      {showRecap && <RecapBanner year={recapYear()} closable className="mx-5" />}
      {counts.following === 0 ? <MatchRow matches={matches} /> : <PeopleRow ratings={feed} now={now} />}
      <div className="flex flex-col gap-4">
        {big && <RatingTile rating={big} date={date(big)} />}
        {counts.following > 0 && !big && <p className="px-5 text-meta text-muted">팔로잉의 새 평가가 아직 없어요</p>}
        <ActionTiles tiles={tiles} />
        <WaitLine visitTags={visitTags ?? 0} unrated={tiers.unrated ?? 0} />
      </div>
      {more.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="px-5 pt-2 text-[15px] font-bold tracking-[-0.015em]">새 평가 {more.length}개 더</h2>
          {more.map((r) => (
            <RatingTile key={`${r.ownerId}:${r.placeId}`} rating={r} date={date(r)} compact />
          ))}
          <Link href="/feed" className="flex h-11 items-center justify-center gap-1 text-meta font-semibold text-ink-2">
            피드에서 더 보기
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        </section>
      )}
      {!empty && <MyMap home={home} tiers={tiers} />}
      <RecentSaved home={home} covers={covers} />
      <RankTop ranked={ranking.ranked} unranked={ranking.unranked.length} />
      {counts.following > 0 && <SimilarPeople matches={matches} />}
      <RecentLists lists={lists} covers={covers} />
    </>
  );
}

// 요청 시각 — 그리기 함수 밖에서 읽는다 (react-hooks/purity)
function feedAsOf(): string {
  return new Date().toISOString();
}
