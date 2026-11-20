import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FollowButton } from "@/features/social/FollowButton";
import { RatingCard } from "@/features/social/RatingCard";
import { getFollowCounts, getPerson, getProfileRatings, isFollowing } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "프로필" };

export default function ProfilePage({ params }: PageProps<"/u/[userId]">) {
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
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

// 보는 사람 권한으로 읽는다 — 공개 평가, 팔로우 중이면 팔로워 공개까지
async function Profile({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createSupabaseServerClient();
  const person = await getPerson(supabase, userId);
  if (!person) notFound();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub ?? null;
  const [counts, following, ratings] = await Promise.all([
    getFollowCounts(supabase, person.id),
    me ? isFollowing(supabase, me, person.id) : Promise.resolve(false),
    getProfileRatings(supabase, person),
  ]);

  return (
    <div className="flex flex-col px-5">
      <section className="flex items-center gap-4 pb-5">
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-surface-2 text-title font-bold text-ink-2">
          {person.nickname.slice(0, 1)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-section font-bold">{person.nickname}</span>
          <span className="text-meta text-muted">
            평가 {ratings.length} · 팔로워 {counts.followers} · 팔로잉 {counts.following}
          </span>
        </div>
        {me && me !== person.id && <FollowButton targetId={person.id} following={following} />}
        {!me && (
          <Link href="/" className="flex h-btn-m items-center rounded-btn-m bg-ink px-4 text-body font-bold text-white">
            팔로우
          </Link>
        )}
      </section>
      {ratings.length === 0 ? (
        <p className="border-t border-line py-10 text-center text-meta text-muted">
          {me === person.id ? "공개하거나 팔로워에게 보여준 평가가 아직 없어요. 평가 화면에서 공개 범위를 바꿔 보세요." : "볼 수 있는 평가가 아직 없어요."}
        </p>
      ) : (
        <div className="border-t border-line">
          {ratings.map((r) => (
            <RatingCard key={r.placeId} rating={r} showOwner={false} />
          ))}
        </div>
      )}
    </div>
  );
}
