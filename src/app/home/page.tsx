import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NICKNAME_SETUP } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { countUnrated } from "@/features/rating/rating";
import { RatingCard } from "@/features/social/RatingCard";
import { getFeed, getTasteMatches } from "@/features/social/social";
import { TasteMatches } from "@/features/social/TasteMatches";

// 홈 — 평가 전 알림 · 팔로우한 사람들의 평가
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <main className="flex flex-1 flex-col gap-6 px-5 py-8">
        <Suspense fallback={<h1 className="text-title font-bold tracking-tight">반가워요</h1>}>
          <Greeting />
        </Suspense>
        <Suspense fallback={null}>
          <UnratedCard />
        </Suspense>
        <Suspense fallback={null}>
          <Matches />
        </Suspense>
        <Suspense fallback={null}>
          <Feed />
        </Suspense>
      </main>
      <div className="sticky bottom-0">
        <BottomNav />
      </div>
    </div>
  );
}

// 쿠키(세션)를 읽는 부분만 요청 시점에 그린다
async function Greeting() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("nickname, nickname_set_at").eq("id", userId).single()
    : { data: null };
  if (profile && !profile.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=/home`);
  return <h1 className="text-title font-bold tracking-tight">{profile?.nickname ?? "MY"}님, 반가워요</h1>;
}

// 평가 전이 남아 있으면 빠르게 평가하기로 — 없으면 아무것도 그리지 않는다
async function UnratedCard() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const unrated = userId ? await countUnrated(supabase, userId) : 0;
  if (unrated === 0) return null;
  return (
    <Link href="/rate" className="flex items-center justify-between gap-3 rounded-btn-l bg-surface px-4 py-3.5">
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-bold">평가 전 {unrated}곳</span>
        <span className="text-meta text-muted">한 곳씩 등급만 고르면 돼요</span>
      </span>
      <span className="shrink-0 text-meta font-bold text-ink">빠르게 평가하기</span>
    </Link>
  );
}

// 팔로우한 사람의 공개 · 팔로워 공개 평가 — 아직 없으면 사람 찾기 · 가져오기로
async function Feed() {
  const supabase = await createSupabaseServerClient();
  const feed = await getFeed(supabase);
  if (feed.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-btn-l bg-surface p-5">
        <span className="text-body font-bold">팔로우한 사람들의 평가가 여기 보여요</span>
        <span className="text-meta leading-normal text-muted">믿을 만한 사람을 팔로우하고, 내 장소도 가져와 평가해 보세요.</span>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link href="/people" className="flex h-btn-m items-center justify-center rounded-btn-m bg-ink text-body font-bold text-white">
            사람 찾기
          </Link>
          <Link href="/import" className="flex h-btn-m items-center justify-center rounded-btn-m border border-line-strong bg-white text-body text-ink">
            장소 가져오기
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col">
      <h2 className="text-section font-bold">팔로잉 소식</h2>
      {feed.map((r) => (
        <RatingCard key={`${r.ownerId}:${r.placeId}`} rating={r} showOwner />
      ))}
    </section>
  );
}

async function Matches() {
  const supabase = await createSupabaseServerClient();
  return <TasteMatches matches={await getTasteMatches(supabase, 8)} />;
}
