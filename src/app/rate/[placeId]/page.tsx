import { BackButton } from "@/components/BackButton";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNextPath, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { RatingForm } from "@/features/rating/RatingForm";
import { getSavedPlace } from "@/features/rating/rating";
import { getMyVisits } from "@/features/visit/visit";
import { getMenu } from "@/features/place/menu";
import { getPlace } from "@/features/place/place";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "평가 작성" };

export default function RatePlacePage({ params, searchParams }: PageProps<"/rate/[placeId]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Suspense fallback={null}>
        <RatePlace params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 세션 · 장소를 읽는 부분만 요청 시점에 그린다
async function RatePlace({
  params,
  searchParams,
}: {
  params: Promise<{ placeId: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const [{ placeId }, { next }] = await Promise.all([params, searchParams]);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);

  if (!/^[0-9a-f-]{36}$/.test(placeId)) notFound();
  // 평가 · 함께 방문 · 장소를 한 번에 — 메뉴판(외부)은 기다리지 않고 폼에 약속으로 넘긴다
  const [place, visits, detail] = await Promise.all([getSavedPlace(supabase, userId, placeId), getMyVisits(supabase, placeId), getPlace(supabase, placeId)]);
  if (!place) notFound();
  const kakao = detail?.sources.find((s) => s.source === "kakao" && !s.sourcePlaceId.startsWith("N"));
  const menuOptions: Promise<string[]> = detail
    ? getMenu({ name: detail.name, lat: detail.lat, lng: detail.lng, kakaoPlaceId: kakao?.sourcePlaceId ?? null, naverPlaceId: detail.sources.find((s) => s.source === "naver")?.sourcePlaceId ?? null })
        // 대표 메뉴 먼저
        .then((menu) => (menu?.items ?? []).sort((a, b) => Number(b.recommended) - Number(a.recommended)).map((m) => m.name.trim().slice(0, 30)).filter(Boolean))
        .catch(() => [])
    : Promise.resolve([]);
  const back = safeNextPath(typeof next === "string" ? next : null);

  return (
    <>
      <header className="flex items-center justify-between pt-4 pr-2 pb-2 pl-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="truncate text-section font-bold">{place.name}</h1>
          <span className="text-meta text-muted">평가 · 메모</span>
        </div>
        <BackButton fallback={back} kind="close" />
      </header>
      <RatingForm place={place} next={back} userId={userId} visits={visits} menuOptions={menuOptions} />
    </>
  );
}
