"use server";

import { redirect } from "next/navigation";
import { ImportError, type ImportErrorCode } from "@/domain/importedPlace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { NaverSharedListSource } from "./naver/naverSharedListSource";
import { ImportModeSchema, type ImportMode } from "./importMode";
import { ImportSaveError, saveImportedList, type ImportResult } from "./saveImportedList";

export type ListPreview = { listId: string; name: string; count: number; unavailable: number };
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code: ImportErrorCode | "SAVE_FAILED" };

const ERROR_MESSAGE: Record<ImportErrorCode, string> = {
  INVALID_LINK: "네이버 지도 리스트의 공유 링크를 넣어 주세요.",
  LIST_NOT_FOUND_OR_PRIVATE: "리스트를 찾을 수 없어요. 네이버 지도에서 공개 범위를 ‘일부 공개’ 이상으로 바꿔 주세요.",
  UPSTREAM_ERROR: "네이버 지도에서 리스트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
  UNEXPECTED_RESPONSE: "네이버 지도에서 리스트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
};
const SAVE_FAILED = "저장하지 못했어요. 다시 시도해 주세요.";

// 링크만 받아 리스트 이름 · 개수를 먼저 보여 준다 — 저장은 방식을 고른 뒤
export async function previewNaverList(link: string): Promise<ActionResult<ListPreview>> {
  await requireUserId();
  try {
    const list = await new NaverSharedListSource().fetchList(link);
    return {
      ok: true,
      data: { listId: list.sourceListId, name: list.name, count: list.places.length, unavailable: list.places.filter((p) => !p.available).length },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function importNaverList(link: string, mode: ImportMode): Promise<ActionResult<ImportResult>> {
  const parsedMode = ImportModeSchema.safeParse(mode);
  if (!parsedMode.success) return { ok: false, error: SAVE_FAILED, code: "SAVE_FAILED" };
  const { supabase, userId } = await requireUserId();
  try {
    const list = await new NaverSharedListSource().fetchList(link);
    return { ok: true, data: await saveImportedList(supabase, userId, list, parsedMode.data) };
  } catch (error) {
    return failure(error);
  }
}

async function requireUserId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  return { supabase, userId };
}

function failure(error: unknown): Extract<ActionResult<never>, { ok: false }> {
  if (error instanceof ImportError) return { ok: false, error: ERROR_MESSAGE[error.code], code: error.code };
  if (error instanceof ImportSaveError) return { ok: false, error: SAVE_FAILED, code: "SAVE_FAILED" };
  throw error;
}
