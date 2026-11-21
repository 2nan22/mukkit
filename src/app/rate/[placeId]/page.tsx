import { BackButton } from "@/components/BackButton";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNextPath, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { RatingForm } from "@/features/rating/RatingForm";
import { getSavedPlace } from "@/features/rating/rating";
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

  const place = /^[0-9a-f-]{36}$/.test(placeId) ? await getSavedPlace(supabase, userId, placeId) : null;
  if (!place) notFound();
  const back = safeNextPath(typeof next === "string" ? next : null);

  return (
    <>
      <header className="flex items-center justify-between pt-4 pr-2 pb-2 pl-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-meta text-muted">{place.name}</span>
          <h1 className="text-section font-bold">평가 · 메모</h1>
        </div>
        <BackButton fallback={back} kind="close" />
      </header>
      <RatingForm place={place} next={back} userId={userId} />
    </>
  );
}
