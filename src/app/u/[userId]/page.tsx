import { getMyLists, VISIBILITY_LABEL } from "@/features/lists/lists";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AppHeader } from "@/components/AppHeader";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
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
      <AppHeader kind="back" fallback="/home" title="프로필" />
      <Suspense fallback={<ListSkeleton />}>
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
    // 본인 프로필은 비공개 리스트까지 (남에게는 공개 리스트만)
    me === person.id
      ? getMyLists(supabase, me).then((ls) => ls.map((l) => ({ id: l.id, name: l.name, count: l.count, visibility: l.visibility })))
      : getProfileLists(supabase, person.id).then((ls) => ls.map((l) => ({ ...l, visibility: null }))),
    getBio(supabase, person.id),
    me && me !== person.id ? getTasteWith(supabase, person.id) : Promise.resolve(null),
  ]);
  const rated = stats.three + stats.two + stats.one + stats.notRecommended;
  // 숫자는 집계 값으로 — 아래 목록은 최근 것부터 일부만 불러온다
  const ratedTotal = rated + stats.sponsored;
  const share = (n: number) => (rated ? (n / rated) * 100 : 0);
  const showLists = tab === "lists";

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-4 border-b-8 border-surface px-5 pb-5">
        <div className="flex items-center gap-4">
          <Avatar name={person.nickname} size={56} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-section font-bold">{person.nickname}</span>
            <span className="text-meta text-muted">
              평가 {ratedTotal}곳 · 팔로워 {counts.followers} · 팔로잉 {counts.following}
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
          <div className="flex flex-col gap-1 rounded-[16px] bg-brand-soft px-4 py-3.5">
            <span className="text-body font-bold text-brand">취향 일치 {Math.round(taste.similarity * 100)}%</span>
            <span className="text-meta text-ink-2">
              같이 평가한 곳 <b className="whitespace-nowrap text-ink">{taste.overlap}곳</b> · 둘 다 3스타 <b className="whitespace-nowrap text-ink">{taste.bothThree}곳</b>
            </span>
          </div>
        )}

        {me && me !== person.id && <FollowButton targetId={person.id} following={following} primary />}
        {!me && (
          <Link href="/" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
            마이슐랭 시작하고 팔로우하기
          </Link>
        )}
      </section>

      <div role="tablist" className="grid grid-cols-2 border-b border-line">
        <Link role="tab" aria-selected={!showLists} href={`/u/${person.id}`} replace className={`flex h-11 items-center justify-center text-body ${!showLists ? "border-b-2 border-ink font-bold" : "text-subtle"}`}>
          평가 {ratedTotal}
        </Link>
        <Link role="tab" aria-selected={showLists} href={`/u/${person.id}?tab=lists`} replace className={`flex h-11 items-center justify-center text-body ${showLists ? "border-b-2 border-ink font-bold" : "text-subtle"}`}>
          리스트 {lists.length}
        </Link>
      </div>

      <div className="px-5">
        {showLists ? (
          lists.length === 0 ? (
            <p className="py-10 text-center text-meta text-muted">{me === person.id ? "만든 리스트가 아직 없어요" : "공개한 리스트가 아직 없어요"}</p>
          ) : (
            lists.map((l) => (
              <Link key={l.id} href={l.visibility ? `/lists/${l.id}` : `/l/${l.id}`} className="flex min-h-16 flex-col justify-center gap-0.5 border-b border-line py-2">
                <span className="truncate text-body font-bold">{l.name}</span>
                <span className="text-meta text-muted">
                  {l.count}곳{l.visibility && ` · ${VISIBILITY_LABEL[l.visibility]}`}
                </span>
              </Link>
            ))
          )
        ) : ratings.length === 0 ? (
          <p className="py-10 text-center text-meta text-muted">
            {me === person.id ? "공개한 평가가 아직 없어요. 평가할 때 공개 범위를 바꿀 수 있어요." : "볼 수 있는 평가가 아직 없어요."}
          </p>
        ) : (
          ratings.map((r) => <RatingCard key={r.placeId} rating={r} showOwner={false} />)
        )}
      </div>
    </div>
  );
}
