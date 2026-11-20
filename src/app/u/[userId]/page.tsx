import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FollowButton } from "@/features/social/FollowButton";
import { RatingCard } from "@/features/social/RatingCard";
import {
  getBio,
  getFollowCounts,
  getPerson,
  getProfileLists,
  getProfileRatings,
  getProfileStats,
  getTasteWith,
  isFollowing,
} from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "프로필" };

export default function ProfilePage({ params, searchParams }: PageProps<"/u/[userId]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/home" aria-label="홈으로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">프로필</h1>
        <span />
      </header>
      <Suspense fallback={null}>
        <Profile params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 보는 사람 권한으로 읽는다 — 공개 평가, 팔로우 중이면 팔로워 공개까지
async function Profile({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const [{ userId }, { tab }] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const person = await getPerson(supabase, userId);
  if (!person) notFound();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub ?? null;
  const [counts, following, ratings, stats, lists, bio, taste] = await Promise.all([
    getFollowCounts(supabase, person.id),
    me ? isFollowing(supabase, me, person.id) : Promise.resolve(false),
    getProfileRatings(supabase, person),
    getProfileStats(supabase, person.id),
    getProfileLists(supabase, person.id),
    getBio(supabase, person.id),
    me && me !== person.id ? getTasteWith(supabase, person.id) : Promise.resolve(null),
  ]);
  const rated = stats.three + stats.two + stats.one + stats.notRecommended;
  const share = (n: number) => (rated ? (n / rated) * 100 : 0);
  const showLists = tab === "lists";

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-4 border-b-8 border-surface px-5 pb-5">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-2 text-title font-bold text-ink-2">
            {person.nickname.slice(0, 1)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-section font-bold">{person.nickname}</span>
            <span className="text-meta text-muted">
              평가 {ratings.length}곳 · 팔로워 {counts.followers} · 팔로잉 {counts.following}
            </span>
          </div>
        </div>
        {bio && <p className="text-body leading-normal text-ink-2">{bio}</p>}

        {rated > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
              <div className="bg-tier-3" style={{ width: `${share(stats.three)}%` }} />
              <div className="bg-pin-2" style={{ width: `${share(stats.two)}%` }} />
              <div className="bg-pin-1" style={{ width: `${share(stats.one)}%` }} />
              <div className="bg-pin-none" style={{ width: `${share(stats.notRecommended)}%` }} />
            </div>
            <div className="flex justify-between text-meta text-muted">
              <span>
                3스타 비율 <b className="text-ink">{Math.round(share(stats.three))}%</b>
              </span>
              <span>협찬 · 이벤트 평가 {stats.sponsored}건</span>
            </div>
          </div>
        )}

        {taste && taste.overlap > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-btn-m bg-tier-3-soft px-3.5 py-3 text-meta text-ink-2">
            <span>
              나와 겹치는 곳 <b className="text-ink">{taste.overlap}곳</b> · 그중 둘 다 3스타 <b className="text-tier-3">{taste.bothThree}곳</b>
            </span>
            <span className="shrink-0 font-bold text-tier-3">비슷함 {Math.round(taste.similarity * 100)}%</span>
          </div>
        )}

        {me && me !== person.id && <FollowButton targetId={person.id} following={following} />}
        {!me && (
          <Link href="/" className="flex h-btn-l items-center justify-center rounded-btn-l bg-ink text-[16px] font-bold text-white">
            마이슐랭 시작하고 팔로우하기
          </Link>
        )}
      </section>

      <div role="tablist" className="grid grid-cols-2 border-b border-line">
        <Link role="tab" aria-selected={!showLists} href={`/u/${person.id}`} replace className={`flex h-11 items-center justify-center text-body ${!showLists ? "border-b-2 border-ink font-bold" : "text-muted"}`}>
          평가 {ratings.length}
        </Link>
        <Link role="tab" aria-selected={showLists} href={`/u/${person.id}?tab=lists`} replace className={`flex h-11 items-center justify-center text-body ${showLists ? "border-b-2 border-ink font-bold" : "text-muted"}`}>
          리스트 {lists.length}
        </Link>
      </div>

      <div className="px-5">
        {showLists ? (
          lists.length === 0 ? (
            <p className="py-10 text-center text-meta text-muted">공개한 리스트가 아직 없어요.</p>
          ) : (
            lists.map((l) => (
              <Link key={l.id} href={`/l/${l.id}`} className="flex min-h-16 flex-col justify-center gap-0.5 border-b border-line py-2">
                <span className="truncate text-body font-bold">{l.name}</span>
                <span className="text-meta text-muted">{l.count}곳</span>
              </Link>
            ))
          )
        ) : ratings.length === 0 ? (
          <p className="py-10 text-center text-meta text-muted">
            {me === person.id ? "공개하거나 팔로워에게 보여준 평가가 아직 없어요. 평가 화면에서 공개 범위를 바꿔 보세요." : "볼 수 있는 평가가 아직 없어요."}
          </p>
        ) : (
          ratings.map((r) => <RatingCard key={r.placeId} rating={r} showOwner={false} />)
        )}
      </div>
    </div>
  );
}
