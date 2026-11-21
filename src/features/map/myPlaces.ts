import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { tierFromDb, type Tier } from "@/domain/tier";
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
};

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
