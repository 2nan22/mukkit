"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "rating-media";
const Target = z.object({ source: z.enum(["naver", "kakao"]), sourceListId: z.string().min(1).max(200) });

async function signedIn() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  return supabase;
}

// 장소까지 지우면 몇 곳이 지워지는지 — 다른 리스트 · 다른 원본에 있는 곳은 빼고
export async function countDeletable(source: string, sourceListId: string): Promise<number | null> {
  const t = Target.safeParse({ source, sourceListId });
  if (!t.success) return null;
  const supabase = await signedIn();
  // 목록은 1000행에서 잘리므로 개수만 센다
  const { count, error } = await supabase.rpc("import_source_delete_targets", { p_source: t.data.source, p_source_list_id: t.data.sourceListId }, { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

// 가져오기 끊기 — deletePlaces 면 이 원본에서만 온 곳의 평가 · 사진과 먹킷 리스트까지
export async function disconnectSource(source: string, sourceListId: string, deletePlaces: boolean): Promise<{ error?: string; done?: string }> {
  const t = Target.safeParse({ source, sourceListId });
  if (!t.success) return { error: "끊지 못했어요." };
  const supabase = await signedIn();
  const { data, error } = await supabase.rpc("disconnect_import_source", {
    p_source: t.data.source,
    p_source_list_id: t.data.sourceListId,
    p_delete_places: deletePlaces,
  });
  if (error) return { error: "끊지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  // 평가는 지워졌으니 파일은 다시 볼 수 없다 — 지우다 실패해도 결과는 그대로 알린다
  const paths = (data as string[] | null) ?? [];
  for (let i = 0; i < paths.length; i += 100) {
    const res = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (res.error) console.warn("[import] 끊은 원본 사진 삭제 실패: count=%d", paths.length);
  }
  for (const p of ["/import/sources", "/lists", "/map", "/my"]) revalidatePath(p);
  return { done: deletePlaces ? "가져온 곳을 지웠어요" : "연결을 끊었어요" };
}
