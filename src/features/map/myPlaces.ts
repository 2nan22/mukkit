import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { TIER_LABEL, tierFromDb, type Tier } from "@/domain/tier";
import type { Cuisine } from "@/domain/cuisine";

export type SourceLink = { source: PlaceSourceName; url: string };

export type MapPlace = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  cuisine: Cuisine;
  categoryName: string;
  available: boolean;
  tier: Tier;
  note: string;
  links: SourceLink[];
  // 팔로잉 지도 — 이 곳을 평가한 팔로잉 (등급 높은 순). 내 지도에서는 없음
  raters?: Rater[];
  // 팔로잉 지도 — 내가 저장했으면 내 등급
  myTier?: Tier | null;
};

export type Rater = { userId: string; nickname: string; tier: Tier };

type FollowingRow = {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  cuisine: string;
  category_name: string;
  available: boolean;
  raters: { userId: string; nickname: string; tier: string }[];
  my_tier: string | null;
};

// 팔로잉 지도 — 팔로우하는 사람이 평가한 곳 (볼 수 있는 평가만 · 협찬 제외). 핀 등급은 그중 가장 높은 실제 평가
export async function getFollowingMapPlaces(supabase: SupabaseClient): Promise<MapPlace[]> {
  const { data, error } = await supabase.rpc("following_map_places");
  if (error) throw new Error(`팔로잉 지도 조회 실패: ${error.code}`);
  return (data as FollowingRow[]).map((r) => {
    const raters = r.raters.map((x) => ({ userId: x.userId, nickname: x.nickname, tier: tierFromDb(x.tier) }));
    return {
      placeId: r.place_id,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      cuisine: r.cuisine as Cuisine,
      categoryName: r.category_name,
      available: r.available,
      tier: raters[0]?.tier ?? "unrated",
      note: "",
      links: [],
      raters,
      myTier: r.my_tier ? tierFromDb(r.my_tier) : null,
    };
  });
}

// '민지 3숟가락 · 외 2명' — 등급은 사람에 붙인다 (가게 점수처럼 읽히지 않게)
export function ratersLine(raters: Rater[]): string {
  if (raters.length === 0) return "";
  const first = `${raters[0].nickname} ${TIER_LABEL[raters[0].tier]}`;
  return raters.length === 1 ? first : `${first} · 외 ${raters.length - 1}명`;
}

const SOURCE_URL: Record<PlaceSourceName, (id: string) => string> = {
  naver: (id) => `https://map.naver.com/p/entry/place/${id}`,
  kakao: (id) => `https://place.map.kakao.com/${id}`,
};

type Row = {
  tier: string;
  note: string;
  places: {
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string;
    cuisine: string;
    category_name: string;
    available: boolean;
    place_sources: { source: string; source_place_id: string }[];
  } | null;
};

// 내가 저장한 장소 전부 — 원문 링크는 주소로 저장한 항목(카카오 N…)을 빼고 출처마다 하나
export async function getMyMapPlaces(supabase: SupabaseClient, userId: string): Promise<MapPlace[]> {
  const { data, error } = await supabase
    .from("user_places")
    .select("tier, note, places(id, name, lat, lng, address, cuisine, category_name, available, place_sources(source, source_place_id))")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`지도 장소 조회 실패: ${error.code}`);
  return data.flatMap((row) => (row.places ? [toMapPlace(row, row.places)] : []));
}

function toMapPlace(row: Row, p: NonNullable<Row["places"]>): MapPlace {
  const links = p.place_sources.flatMap((s) => {
    const source = s.source as PlaceSourceName;
    if (!(source in SOURCE_URL) || /^N/.test(s.source_place_id)) return [];
    return [{ source, url: SOURCE_URL[source](s.source_place_id) }];
  });
  return {
    placeId: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    address: p.address,
    cuisine: p.cuisine as Cuisine,
    categoryName: p.category_name,
    available: p.available,
    tier: tierFromDb(row.tier),
    note: row.note,
    links,
  };
}
