import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui/EatingLoader";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getRecap, isRecapSeason, isRecapYear, recapYear } from "@/features/recap/recap";
import { RecapStory } from "@/features/recap/RecapStory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "연말 결산" };

// 연말 결산 (70 · 94) — 넘기는 카드. 12 · 1월엔 올해(1월은 지난해), 그 밖엔 ?year= 로 지난 결산
// 아직 안 온 해 · 결산 전 해는 없는 화면
export default function RecapPage({ searchParams }: PageProps<"/my/recap">) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Recap searchParams={searchParams} />
    </Suspense>
  );
}

async function Recap({ searchParams }: { searchParams: PageProps<"/my/recap">["searchParams"] }) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const q = (await searchParams).year;
  const year = typeof q === "string" ? Number(q) : isRecapSeason() ? recapYear() : NaN;
  if (!isRecapYear(year)) notFound();
  const recap = await getRecap(supabase, me, year);

  if (recap.rated === 0) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
        <AppHeader kind="back" fallback="/my/stats" title={`${year} 결산`} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 pb-24 text-center">
          <span className="text-body font-semibold">{year}년에 등급을 매긴 곳이 없어요</span>
          <span className="text-meta text-muted">다녀온 곳에 등급을 매기면 결산을 볼 수 있어요</span>
          <Link href="/rate" className="mt-2 flex h-11 items-center rounded-btn-m bg-surface px-4 text-body font-semibold text-ink">
            빠르게 평가하기
          </Link>
        </div>
      </main>
    );
  }
  return <RecapStory recap={recap} />;
}
