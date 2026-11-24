import { PageLoader } from "@/components/ui/EatingLoader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { RATED_DB_TIERS, type RatingVisibility } from "@/features/rating/rating";
import { VisibilityAll } from "@/features/rating/VisibilityAll";
import { MemoToReview } from "@/features/rating/MemoToReview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "평가 공개 범위" };

// 설정 › 평가 공개 범위 (68) — 가져온 등급이 모두 '나만'으로 남아 피드에 안 보이던 것을 한 번에
export default function VisibilitySettingsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/settings" title="평가 공개 범위" />
      <Suspense fallback={<PageLoader />}>
        <Counts />
      </Suspense>
    </main>
  );
}

async function Counts() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  // 1000행 제한을 피해 개수만 (55)
  const count = (v: RatingVisibility) =>
    supabase.from("user_places").select("place_id", { count: "exact", head: true }).eq("user_id", me).in("tier", RATED_DB_TIERS).eq("visibility", v).then((r) => r.count ?? 0);
  const [priv, followers, pub, memos] = await Promise.all([
    count("private"),
    count("followers"),
    count("public"),
    supabase.rpc("count_notes_to_review", { p_user: me }).then((r) => (r.data as number | null) ?? 0),
  ]);
  return (
    <>
      <VisibilityAll counts={{ private: priv, followers, public: pub }} />
      <MemoToReview count={memos} />
    </>
  );
}
