import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getThreeRanking } from "@/features/rank/rank";
import { RankBoard } from "@/features/rank/RankBoard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "수저 셋 순위" };

// 내 수저 셋 안 순위 — 나만 본다
export default function RankPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" title="내 수저 셋 순위" fallback="/" />
      <main className="flex flex-1 flex-col">
        <p className="px-5 pt-1 text-meta text-muted">나만 보는 순위예요.</p>
        <Suspense fallback={<ListSkeleton />}>
          <Board />
        </Suspense>
      </main>
    </div>
  );
}

async function Board() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const { ranked, unranked } = await getThreeRanking(supabase, userId);
  return <RankBoard ranked={ranked} unranked={unranked} />;
}
