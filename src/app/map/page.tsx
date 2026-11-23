import { PageLoader } from "@/components/ui/EatingLoader";
import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { MapView } from "@/features/map/MapView";
import { getFollowingMapPlaces, getMyMapPlaces } from "@/features/map/myPlaces";
import { MapViewSwitch } from "@/features/map/MapViewSwitch";
import { getFollowCounts } from "@/features/social/social";
import { getMyList, getMyMapLists } from "@/features/lists/lists";
import { TIERS } from "@/domain/tier";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "지도" };

export default function MapPage({ searchParams }: PageProps<"/map">) {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden overscroll-none">
      <AppHeader
        kind="tab"
        title="지도"
        right={
          <Suspense fallback={<PageLoader />}>
            <MapViewSwitch searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<div className="flex-1 bg-map-land" />}>
        <MapLoader searchParams={searchParams} />
      </Suspense>
      <BottomNav />
    </main>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function MapLoader({ searchParams }: { searchParams: Promise<{ tier?: string | string[]; list?: string | string[]; at?: string | string[]; view?: string | string[] }> }) {
  const { tier, list, at, view } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  // ?view=following — 팔로우하는 사람이 평가한 곳
  if (view === "following") {
    const [places, counts] = await Promise.all([getFollowingMapPlaces(supabase), getFollowCounts(supabase, userId)]);
    return <MapView key="following" view="following" places={places} following={counts.following} />;
  }
  // ?list= 이면 그 리스트에 담긴 곳만, ?tier= 이면 그 등급을 미리 고른 채로 — 두 조회는 한 번에
  const [all, only, lists] = await Promise.all([
    getMyMapPlaces(supabase, userId),
    typeof list === "string" ? getMyList(supabase, userId, list).catch(() => null) : Promise.resolve(null),
    getMyMapLists(supabase, userId),
  ]);
  const places = only ? all.filter((p) => only.placeIds.includes(p.placeId)) : all;
  const initialTiers = TIERS.filter((t) => t === tier);
  // ?at=위도,경도 — 홈 '근처 가고 싶은 곳'에서 그 위치로
  const [lat, lng] = typeof at === "string" ? at.split(",").map(Number) : [];
  const atPoint = Number.isFinite(lat) && Number.isFinite(lng) && lat > 33 && lat < 39 && lng > 124 && lng < 132 ? { lat, lng } : null;
  // 주소(리스트 · 위치 · 등급)가 바뀌면 새 화면으로 — 같은 화면을 재사용하면 처음 위치가 다시 정해지지 않아 리스트 자리에 머문다
  return <MapView key={`mine:${typeof list === "string" ? list : ""}:${typeof at === "string" ? at : ""}:${typeof tier === "string" ? tier : ""}`} places={places} initialTiers={initialTiers} at={only ? null : atPoint} lists={only ? [] : lists} />;
}
