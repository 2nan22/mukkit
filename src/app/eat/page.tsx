import { PageLoader } from "@/components/ui/EatingLoader";
import { AppHeader } from "@/components/AppHeader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getEatCandidates, getMyTasteBasis } from "@/features/eat/eat";
import { groupRecommendations } from "@/domain/eatScore";
import { EatView } from "@/features/eat/EatView";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "여기서 뭐 먹지?" };

export default function EatPage({ searchParams }: PageProps<"/eat">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/home" title="여기서 뭐 먹지?" />
      <p className="px-5 pb-4 text-meta leading-normal text-muted">
        내 기록과 믿는 사람의 평가에서만 골라요.
      </p>
      <Suspense fallback={<PageLoader />}>
        <EatLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// ?at=위도,경도&label=이름 — 장소 상세 '이 근처에서 뭐 먹지'에서 그 가게를 기준으로 바로
async function EatLoader({ searchParams }: { searchParams: PageProps<"/eat">["searchParams"] }) {
  const { at, label } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const [lat, lng] = typeof at === "string" ? at.split(",").map(Number) : [];
  const start = Number.isFinite(lat) && Number.isFinite(lng) && lat > 33 && lat < 39 && lng > 124 && lng < 132 ? { lat, lng, label: typeof label === "string" && label.trim() ? label.trim().slice(0, 40) : "고른 곳" } : null;
  const [basis, candidates] = await Promise.all([getMyTasteBasis(supabase, me), start ? getEatCandidates(supabase, start.lat, start.lng, START_RADIUS).catch(() => null) : Promise.resolve(null)]);
  const initial = start && candidates ? { where: start, groups: groupRecommendations(candidates, start, START_RADIUS, basis.pref) } : null;
  return <EatView regions={basis.regions} initial={initial} />;
}

const START_RADIUS = 1000;
