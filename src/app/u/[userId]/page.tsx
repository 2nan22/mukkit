import { UnblockButton } from "@/features/safety/UnblockButton";
import { SafetyMenu } from "@/features/safety/SafetyMenu";
import { getBlockedIds } from "@/features/safety/safety";
import { getMyLists, VISIBILITY_LABEL } from "@/features/lists/lists";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AppHeader } from "@/components/AppHeader";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { FollowButton } from "@/features/social/FollowButton";
import { getReactions, reactionKey, type Reaction } from "@/features/reactions/reactions";
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
  if (!/^[0-9a-f-]{36}$/.test(userId)) notFound();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub ?? null;
  // 사람 · 평가 · 숫자를 한 번에 — 프로필 id 만 있으면 된다 (닉네임은 아래에서 채움)
  const [person, counts, following, ratingsRaw, stats, lists, bio, taste, blockedIds, iBlocked] = await Promise.all([
    getPerson(supabase, userId),
    getFollowCounts(supabase, userId),
    me ? isFollowing(supabase, me, userId) : Promise.resolve(false),
    getProfileRatings(supabase, { id: userId, nickname: "" }),
    getProfileStats(supabase, userId),
    // 본인 프로필은 비공개 리스트까지 (남에게는 공개 리스트만)
    me === userId
      ? getMyLists(supabase, me).then((ls) => ls.map((l) => ({ id: l.id, name: l.name, count: l.count, visibility: l.visibility })))
      : getProfileLists(supabase, userId).then((ls) => ls.map((l) => ({ ...l, visibility: null }))),
    getBio(supabase, userId),
    me && me !== userId ? getTasteWith(supabase, userId) : Promise.resolve(null),
    me && me !== userId ? getBlockedIds(supabase) : Promise.resolve(new Set<string>()),
    me && me !== userId
      ? supabase.from("blocks").select("blocked_id").eq("blocker_id", me).eq("blocked_id", userId).maybeSingle().then((r) => Boolean(r.data))
      : Promise.resolve(false),
  ]);
  if (!person) notFound();
  // 서로 차단한 사이 — 내가 막았으면 해제 안내, 상대가 막았으면 볼 수 없음
  // 상대가 나를 차단했으면 없는 프로필과 같은 화면 — 차단 사실이 드러나지 않게
  if (blockedIds.has(userId) && !iBlocked) notFound();
  if (iBlocked) {
    return (
      <div className="flex flex-col items-start gap-3 px-6 pt-16">
        <h2 className="text-title font-bold tracking-tight">{person.nickname}님을 차단했어요</h2>
        <p className="text-body leading-relaxed text-ink-2">차단을 해제하면 평가와 리스트를 다시 볼 수 있어요.</p>
        <div className="pt-2">
          <UnblockButton userId={userId} />
        </div>
      </div>
    );
  }
  const ratings = ratingsRaw.map((r) => ({ ...r, ownerNickname: person.nickname }));
  // 평가 탭에서만 좋아요 · 댓글 수 — 로그인한 사람만
  const reactions = me && tab !== "lists" ? await getReactions(supabase, ratings) : new Map<string, Reaction>();
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
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-section font-bold">{person.nickname}</span>
              {me && me !== person.id && <SafetyMenu userId={person.id} nickname={person.nickname} />}
            </span>
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
                3숟가락 비율 <b className="text-ink">{Math.round(share(stats.three))}%</b>
              </span>
              <span>협찬 · 이벤트 평가 {stats.sponsored}건</span>
            </div>
            {me === person.id && stats.three > 0 && (
              <Link href="/rank" className="flex h-11 items-center justify-between border-t border-line text-body font-medium">
                나만의 맛집 순위
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-subtle">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            )}
          </div>
        )}

        {taste && taste.overlap > 0 && (
          <div className="flex flex-col gap-1 rounded-[16px] bg-brand-soft px-4 py-3.5">
            <span className="text-body font-bold text-brand">취향 일치 {Math.round(taste.similarity * 100)}%</span>
            <span className="text-meta text-ink-2">
              같이 평가한 곳 <b className="whitespace-nowrap text-ink">{taste.overlap}곳</b> · 둘 다 3숟가락 <b className="whitespace-nowrap text-ink">{taste.bothThree}곳</b>
            </span>
          </div>
        )}

        {me && me !== person.id && <FollowButton targetId={person.id} following={following} primary />}
        {!me && (
          <Link href={`/?next=${encodeURIComponent(`/u/${person.id}`)}`} className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
            먹킷 시작하고 팔로우하기
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
          <>
            {ratings.map((r) => (
              <RatingCard key={r.placeId} rating={r} showOwner={false} viewerId={me} reaction={reactions.get(reactionKey(r.ownerId, r.placeId)) ?? null} />
            ))}
            {ratedTotal > ratings.length && <p className="py-6 text-center text-meta text-muted">최근 평가 {ratings.length}곳까지 보여요</p>}
          </>
        )}
      </div>
    </div>
  );
}
