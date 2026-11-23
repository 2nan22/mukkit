import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";

// 내 3숟가락 순위 — tier_rank 0 이 1위, null 은 아직 안 정함
export type RankPlace = { placeId: string; name: string; address: string; cuisine: Cuisine; visitedOn: string | null; rank: number | null };

type Row = { place_id: string; tier_rank: number | null; visited_on: string | null; places: { name: string; address: string; cuisine: string } | null };

export async function getThreeRanking(supabase: SupabaseClient, userId: string): Promise<{ ranked: RankPlace[]; unranked: RankPlace[] }> {
  const { data, error } = await supabase
    .from("user_places")
    .select("place_id, tier_rank, visited_on, places(name, address, cuisine)")
    .eq("user_id", userId)
    .eq("tier", "three")
    .order("tier_rank", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .returns<Row[]>();
  if (error) throw new Error(`3숟가락 순위 조회 실패: ${error.code}`);
  const all = data.flatMap((r) =>
    r.places ? [{ placeId: r.place_id, name: r.places.name, address: r.places.address, cuisine: r.places.cuisine as Cuisine, visitedOn: r.visited_on, rank: r.tier_rank }] : [],
  );
  return { ranked: all.filter((p) => p.rank !== null), unranked: all.filter((p) => p.rank === null) };
}

// 비교 횟수 — 이분 탐색이라 n곳이면 최대 ceil(log2(n+1))번
export function compareSteps(n: number): number {
  return n === 0 ? 0 : Math.ceil(Math.log2(n + 1));
}
