import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrowthCounts } from "@/domain/growth";

type Row = { ratings: number; reviews: number; media: number; areas: number; kinds: number; ranked: number; likes_points: number; list_saves: number; visits: number; imported: boolean; top_kind: string | null; growth_character: string | null };

// 내 캐릭터가 자란 정도 — 개수만 DB 에서, 점수 · 레벨은 domain/growth 가 계산
export async function getMyGrowth(supabase: SupabaseClient): Promise<GrowthCounts> {
  const { data, error } = await supabase.rpc("my_growth").single<Row>();
  if (error) throw new Error(`성장 조회 실패: ${error.code}`);
  return {
    ratings: data.ratings,
    reviews: data.reviews,
    media: data.media,
    areas: data.areas,
    kinds: data.kinds,
    ranked: data.ranked,
    likesPoints: data.likes_points,
    listSaves: data.list_saves,
    visits: data.visits,
    imported: data.imported,
    topKind: data.top_kind,
    character: data.growth_character,
  };
}
