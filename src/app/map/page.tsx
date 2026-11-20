import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { MapView } from "@/features/map/MapView";
import { getMyMapPlaces } from "@/features/map/myPlaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "지도" };

export default function MapPage() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/home" aria-label="홈으로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">내 장소 지도</h1>
        <span />
      </header>
      <Suspense fallback={<div className="flex-1 bg-map-land" />}>
        <MapLoader />
      </Suspense>
    </main>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function MapLoader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const places = await getMyMapPlaces(supabase, userId);
  return <MapView places={places} />;
}
