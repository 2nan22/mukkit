import { SafetyMenu } from "@/features/safety/SafetyMenu";
import { Memo } from "@/components/ui/Memo";
import { ReactionBar } from "@/features/reactions/ReactionBar";
import { getReactions, reactionKey, type Reaction } from "@/features/reactions/reactions";
import { getPlaceCovers } from "@/features/place/covers";
import { TIER_MEANING } from "@/domain/tier";
import Link from "next/link";
import { AteMenus } from "@/components/ui/AteMenus";
import { Companions } from "@/components/ui/Companions";
import { getMyVisits } from "@/features/visit/visit";
import { Avatar } from "@/components/ui/Avatar";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { GoogleG, KakaoSymbol, NaverN } from "@/components/brand/BrandLogo";
import { TierBadge } from "@/components/ui/TierBadge";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMyLists } from "@/features/lists/lists";
import { getMyMedia, getOtherRatings, getPlace, sourceLinks, type OtherRating } from "@/features/place/place";
import { PlaceBottomBar } from "@/features/place/PlaceBottomBar";
import { MyRatingMenu } from "@/features/rating/MyRatingMenu";
import { PlaceHeaderMap } from "@/features/place/PlaceHeaderMap";
import { getMenu } from "@/features/place/menu";
import { MenuSection } from "@/features/place/MenuSection";
import { getSavedPlace } from "@/features/rating/rating";
import { effectiveNote } from "@/features/rating/noteAudience";
import type { MediaRef } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MetaLine } from "@/components/ui/MetaLine";
import { MapAppLink } from "@/components/ui/MapAppLink";
import { RouteButton } from "@/features/place/RouteButton";

export const metadata = { title: "장소" };

export default function PlacePage({ params }: PageProps<"/p/[placeId]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Suspense fallback={<div className="h-[200px] bg-map-land" />}>
        <PlaceDetail params={params} />
      </Suspense>
    </main>
  );
}

function dot(d: string | null): string {
  return d ? `${d.replaceAll("-", ".")} 방문` : "";
}

function MediaStrip({ media }: { media: MediaRef[] }) {
  if (media.length === 0) return null;
  return (
    <div className="relative -mx-5 flex gap-1.5 overflow-x-auto px-5">
      {media.map((m, i) =>
        m.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다
          <img key={i} src={m.url} alt="" className="size-28 shrink-0 rounded-btn-m object-cover" />
        ) : (
          <video key={i} src={m.url} controls playsInline preload="metadata" className="size-28 shrink-0 rounded-btn-m bg-black object-cover" />
        ),
      )}
    </div>
  );
}

function OtherRow({ r, placeId, reaction }: { r: OtherRating; placeId: string; reaction: Reaction | null }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line pt-3 pb-1">
      <div className="flex items-center gap-2.5">
        <Link href={`/u/${r.userId}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar name={r.nickname} size={40} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body font-bold">{r.nickname}</span>
            <MetaLine items={[`평가 ${r.ratedCount}곳`, `3숟가락 비율 ${r.threeRatio}%`]} />
          </span>
        </Link>
        {r.sponsored && <span className="rounded border border-line-strong px-1.5 text-caption text-muted">협찬</span>}
        <TierBadge tier={r.tier} />
        <SafetyMenu userId={r.userId} nickname={r.nickname} placeId={placeId} />
      </div>
      {r.review && <p className="text-body leading-normal text-ink-2">{r.review}</p>}
      {(r.note || r.alias) && <Memo text={r.note} alias={r.alias} source={r.noteSource} />}
      <AteMenus menus={r.menus} />
      <Companions people={r.companions} />
      <MediaStrip media={r.media} />
      {r.visitedOn && <span className="text-meta text-muted">{dot(r.visitedOn)}</span>}
      {reaction && <ReactionBar ownerId={r.userId} placeId={placeId} reaction={reaction} mine={false} />}
    </div>
  );
}

// 세션을 읽는 부분만 요청 시점에 그린다
async function PlaceDetail({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  if (!/^[0-9a-f-]{36}$/.test(placeId)) notFound();
  // 장소 id 만 있으면 되는 조회는 한 번에 — 차례로 기다리지 않게
  const [place, mine, myMedia, others, lists, myVisits, covers, listed] = await Promise.all([
    getPlace(supabase, placeId),
    getSavedPlace(supabase, me, placeId),
    getMyMedia(supabase, me, placeId),
    getOtherRatings(supabase, placeId),
    getMyLists(supabase, me),
    getMyVisits(supabase, placeId),
    getPlaceCovers(supabase, [placeId]),
    supabase.from("list_items").select("list_id, lists!inner(owner_id)").eq("place_id", placeId).eq("lists.owner_id", me),
  ]);
  if (!place) notFound();
  // 담기 시트에 '담김' 표시 — 내 리스트 것만
  const inLists = (listed.data ?? []).map((r) => r.list_id as string);
  const myRated = Boolean(mine && ["three", "two", "one", "notRecommended"].includes(mine.tier));
  const reactions = await getReactions(supabase, [...others.map((o) => ({ ownerId: o.userId, placeId })), ...(myRated ? [{ ownerId: me, placeId }] : [])]);
  const reactionOf = (owner: string) => reactions.get(reactionKey(owner, placeId)) ?? null;
  const seen = new Set<string>();
  const myCompanions = myVisits
    .flatMap((v) => v.members.filter((m) => m.status === "accepted"))
    .flatMap((m) => {
      const key = m.userId ?? `g:${m.nickname}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ id: key, nickname: m.nickname, guest: m.guest }];
    });
  const links = sourceLinks(place);
  const kakaoSource = place.sources.find((s) => s.source === "kakao" && !s.sourcePlaceId.startsWith("N"));
  const following = others.filter((o) => o.followed);
  const rest = others.filter((o) => !o.followed);

  return (
    <>
      <PlaceHeaderMap id={place.id} name={place.name} lat={place.lat} lng={place.lng} tier={mine?.tier ?? "unrated"} cover={covers.get(place.id) ?? null} />

      <section className="flex flex-col gap-1 border-b-8 border-surface px-5 pt-4 pb-5">
        <MetaLine items={[CUISINE_LABEL[place.cuisine], place.categoryName].filter((v, i, a) => v && v !== "음식점" && a.indexOf(v) === i)} />
        <h1 className="text-title font-bold tracking-tight">{place.name}</h1>
        <span className="text-body text-ink-2">{place.address}</span>
        {!place.available && <span className="text-meta text-danger">지도에 정보가 없어요. 폐업했을 수 있어요.</span>}
        {/* 지도 앱은 동그란 마크만 오른쪽에 — 왼쪽은 근처 추천 (78, 사용자 제안) · 폰에선 앱, 없으면 웹 · 길찾기는 앱 고르기 */}
        <div className="flex items-center justify-between gap-3 pt-3">
          {/* 이 가게를 기준으로 근처 추천 — 1차 뒤 2차 · 이 동네에서 다른 곳 찾기 */}
          <Link href={`/eat?at=${place.lat.toFixed(5)},${place.lng.toFixed(5)}&label=${encodeURIComponent(place.name)}`} className="flex h-11 min-w-0 items-center gap-1.5 text-meta font-semibold text-ink underline underline-offset-[3px]">
            이 근처에서 뭐 먹지
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {/* 원 자체를 앱 색으로 — 원 안에 네모 타일이 또 들어가지 않게 (78 디자인 검토) */}
            <MapAppLink link={links.naver} label="네이버 지도에서 보기" className="flex size-11 items-center justify-center rounded-full bg-[#03C75A]">
              <NaverN size={15} />
            </MapAppLink>
            <MapAppLink link={links.kakao} label="카카오맵에서 보기" className="flex size-11 items-center justify-center rounded-full bg-[#FEE500]">
              <KakaoSymbol size={20} />
            </MapAppLink>
            <MapAppLink link={links.google} label="구글 지도에서 보기" className="flex size-11 items-center justify-center rounded-full border border-line bg-white">
              <GoogleG size={20} />
            </MapAppLink>
            {/* 길찾기 표준 마크 — 마름모 안 꺾인 화살표(종이비행기는 '보내기'로 읽힘) */}
            <RouteButton links={links.directions} label="길찾기" className="flex size-11 items-center justify-center rounded-full bg-ink text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z" />
                <path d="M9 15v-2.5a1.5 1.5 0 0 1 1.5-1.5H15M13 9l2 2-2 2" />
              </svg>
            </RouteButton>
          </div>
        </div>
      </section>

      {/* 메뉴는 카카오(없으면 네이버)에 묻느라 늦을 수 있어 따로 — 나머지 화면을 막지 않는다 */}
      <Suspense fallback={null}>
        <PlaceMenu name={place.name} lat={place.lat} lng={place.lng} kakaoPlaceId={kakaoSource?.sourcePlaceId ?? null} naverPlaceId={place.sources.find((s) => s.source === "naver")?.sourcePlaceId ?? null} />
      </Suspense>

      <section className="flex flex-col gap-2 border-b-8 border-surface px-5 pt-4 pb-5">
        <div className="flex items-center justify-between">
          <h2 className="text-section font-bold">내 평가</h2>
          {mine && ["three", "two", "one", "notRecommended"].includes(mine.tier) && <MyRatingMenu placeId={place.id} three={mine.tier === "three"} />}
        </div>
        {mine && ["three", "two", "one", "notRecommended"].includes(mine.tier) ? (
          <div className="flex flex-col gap-2.5 rounded-[16px] bg-surface p-4">
            {/* 좁은 폭에서 '곳' · '위' · '방문'이 한 글자씩 떨어지지 않게 항목 단위로 줄을 넘긴다 */}
            <div className="flex flex-wrap items-center gap-x-2">
              <TierBadge tier={mine.tier} />
              <span className="text-meta font-medium whitespace-nowrap text-ink-2">{TIER_MEANING[mine.tier]}</span>
              {mine.tier === "three" && (
                <Link href="/rank" className="inline-flex min-h-11 items-center text-meta font-semibold whitespace-nowrap text-ink underline underline-offset-[3px]">
                  {mine.rank ? `3숟가락 중 ${mine.rank}위` : "순위 정하기"}
                </Link>
              )}
              {mine.visitedOn && <span className="ml-auto text-meta whitespace-nowrap text-subtle">{dot(mine.visitedOn)}</span>}
            </div>
            {mine.review && <p className="text-body leading-relaxed">{mine.review}</p>}
            <AteMenus menus={mine.menus} />
            <Companions people={myCompanions} />
            <MediaStrip media={myMedia} />
            {(mine.note || mine.alias) && <Memo tone="white" text={mine.note} alias={mine.alias} source={mine.noteSource} audience={effectiveNote(mine.visibility, mine.noteVisibility)} />}
            {reactionOf(me) && <ReactionBar ownerId={me} placeId={place.id} reaction={reactionOf(me)!} mine />}
          </div>
        ) : mine ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <TierBadge tier={mine.tier} />
            </div>
            {(mine.note || mine.alias) && <Memo text={mine.note} alias={mine.alias} source={mine.noteSource} audience="private" />}
          </div>
        ) : (
          <p className="text-meta text-muted">아직 저장하지 않은 곳이에요</p>
        )}
      </section>

      <section className="flex flex-1 flex-col px-5 pt-4 pb-4">
        <h2 className="text-section font-bold">팔로잉 평가</h2>
        {following.length === 0 && <p className="py-3 text-meta text-muted">팔로잉 중에는 아직 평가한 사람이 없어요</p>}
        {following.map((r) => (
          <OtherRow key={r.userId} r={r} placeId={place.id} reaction={reactionOf(r.userId)} />
        ))}
        {rest.length > 0 && (
          <>
            <h2 className="pt-5 text-section font-bold">다른 사람 평가</h2>
            {rest.map((r) => (
              <OtherRow key={r.userId} r={r} placeId={place.id} reaction={reactionOf(r.userId)} />
            ))}
          </>
        )}
      </section>

      <PlaceBottomBar placeId={place.id} saved={Boolean(mine)} rated={Boolean(mine && ["three", "two", "one", "notRecommended"].includes(mine.tier))} lists={lists.map((l) => ({ id: l.id, name: l.name }))} inLists={inLists} />
    </>
  );
}

async function PlaceMenu(target: { name: string; lat: number; lng: number; kakaoPlaceId: string | null; naverPlaceId: string | null }) {
  const menu = await getMenu(target).catch(() => null);
  return menu ? <MenuSection menu={menu} /> : null;
}
