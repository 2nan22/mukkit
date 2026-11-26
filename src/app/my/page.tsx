import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { AppHeader } from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { BottomNav } from "@/components/BottomNav";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { countMyTiers } from "@/features/lists/lists";
import { getBio, getFollowCounts, getPerson } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyGrowth } from "@/features/growth/growth";
import { GrowthCard } from "@/features/growth/GrowthCard";
import { MetaLine } from "@/components/ui/MetaLine";

export const metadata = { title: "내 정보" };


export default function MyPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="tab" title="내 정보" right={
          <Link href="/settings" aria-label="설정" className="flex size-11 items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        } />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <MyContent />
        </Suspense>
      </main>
      <div className="sticky bottom-0 z-30">
        <BottomNav />
      </div>
    </div>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function MyContent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const [person, bio, counts, tiers, growth] = await Promise.all([
    getPerson(supabase, me),
    getBio(supabase, me),
    getFollowCounts(supabase, me),
    countMyTiers(supabase, me),
    getMyGrowth(supabase),
  ]);
  const saved = Object.values(tiers).reduce((a, b) => a + b, 0);
  const rated = (tiers.three ?? 0) + (tiers.two ?? 0) + (tiers.one ?? 0) + (tiers.not_recommended ?? 0);
  const nickname = person?.nickname ?? "";

  return (
    <>
      <section className="flex flex-col gap-4 border-b-8 border-surface px-5 pt-2 pb-5">
        <div className="flex items-center gap-4">
          <Avatar name={nickname} size={56} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-section font-bold">{nickname}</span>
            {/* 숫자를 누르면 팔로워 · 팔로잉 목록 (74) */}
            <MetaLine
              items={[
              <Link key="followers" href={`/u/${me}/follows`} className="inline-flex min-h-11 items-center">
                팔로워 <b className="font-semibold text-ink">{counts.followers}</b>
              </Link>,
              <Link key="following" href={`/u/${me}/follows?tab=following`} className="inline-flex min-h-11 items-center">
                팔로잉 <b className="font-semibold text-ink">{counts.following}</b>
              </Link>,
              ]}
            />
          </div>
        </div>
        {bio && <p className="text-body leading-normal text-ink-2">{bio}</p>}
        <GrowthCard counts={growth} />
        <div className="grid grid-cols-2 gap-2">
          <Link href="/my/edit" className="flex h-10 items-center justify-center rounded-btn-m bg-surface text-[14px] font-medium text-ink">
            프로필 수정
          </Link>
          <Link href={`/u/${me}`} className="flex h-10 items-center justify-center rounded-btn-m bg-surface text-[14px] font-medium text-ink">
            내 프로필 보기
          </Link>
        </div>
        {/* 등급별 숫자는 리스트 탭 등급 보기로 — 여기는 한 줄 요약만 */}
        <Link href="/lists?view=tier" className="flex h-12 items-center justify-between rounded-[14px] bg-surface px-4 text-body">
          <MetaLine
            className="text-body"
            items={[
              <>
                저장 <b>{saved}</b>곳
              </>,
              <>
                평가 <b>{rated}</b>곳
              </>,
            ]}
          />
          <span className="flex items-center gap-0.5 text-meta font-semibold">
            등급별 보기
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </Link>
      </section>

      <nav aria-label="내 정보 메뉴" className="flex flex-col px-5 pt-4 pb-6">
        {[
          { href: "/meet", label: "약속", icon: "M7 3v3M17 3v3M4 9h16M5 5h14v15H5z" },
          { href: "/my/stats", label: "내 기록 통계", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
          { href: "/rank", label: "나만의 맛집 순위", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" },
          { href: "/people", label: "사람 찾기", icon: "M10 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM3 20c.8-3.5 3.6-5.5 7-5.5M15.5 15.5a3 3 0 1 0 4.2 4.2 3 3 0 0 0-4.2-4.2zM19.7 19.7L21 21" },
          { href: "/import", label: "저장한 장소 가져오기", icon: "M12 4v11M7 10l5 5 5-5M5 20h14" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="flex min-h-14 items-center gap-3 border-b border-line text-body">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-2" aria-hidden="true">
              <path d={l.icon} />
            </svg>
            <span className="flex-1">{l.label}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-subtle" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </nav>
    </>
  );
}
