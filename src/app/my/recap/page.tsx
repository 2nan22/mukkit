import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getRecap, RECAP_MIN } from "@/features/recap/recap";
import { RecapStory } from "@/features/recap/RecapStory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "연말 결산" };

// 연말 결산 (70) — 넘기는 카드. 들어가는 곳은 12 · 1월에만 보이지만 주소로는 언제든 열린다
export default async function RecapPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const recap = await getRecap(supabase, me);

  if (recap.rated < RECAP_MIN) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
        <AppHeader kind="back" fallback="/my/stats" title={`${recap.year} 결산`} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 pb-24 text-center">
          <span className="text-body font-semibold">올해 평가한 곳이 {recap.rated}곳이에요</span>
          <span className="text-meta text-muted">{RECAP_MIN}곳을 평가하면 한 해 결산을 볼 수 있어요</span>
          <Link href="/rate" className="mt-2 flex h-11 items-center rounded-btn-m bg-surface px-4 text-body font-semibold text-ink">
            빠르게 평가하기
          </Link>
        </div>
      </main>
    );
  }
  return <RecapStory recap={recap} />;
}
