"use server";

import { allowCall } from "@/lib/rateLimit";
import { redirect } from "next/navigation";
import { ImportError, type ImportErrorCode } from "@/domain/importedPlace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { extractLink, placeSourceFor, sourceNameForLink } from "./sources";
import type { PlaceSourceName } from "@/domain/importedPlace";
import { ImportModeSchema, type ImportMode } from "./importMode";
import { RATING_VISIBILITIES, type RatingVisibility } from "@/features/rating/rating";
import { recordImportSource } from "./refreshImport";
import { ImportSaveError, saveImportedList, type ImportResult } from "./saveImportedList";

export type ListPreview = { listId: string; source: PlaceSourceName; name: string; count: number; unavailable: number };
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: ImportErrorCode | "SAVE_FAILED"; source?: PlaceSourceName };

const ERROR_MESSAGE: Record<ImportErrorCode, string> = {
  INVALID_LINK: "네이버 지도 리스트나 카카오맵 즐겨찾기 폴더의 공유 링크를 넣어 주세요.",
  LIST_NOT_FOUND_OR_PRIVATE: "리스트를 찾을 수 없어요. 공개 범위를 바꾼 뒤 다시 시도해 주세요.",
  UPSTREAM_ERROR: "리스트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
  UNEXPECTED_RESPONSE: "리스트를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
};
const SAVE_FAILED = "저장하지 못했어요. 다시 시도해 주세요.";
const TOO_FAST = "잠깐만요. 1분쯤 뒤에 다시 시도해 주세요.";
// 원본(비공식 API) 호출 — 사용자당 1분에 20번까지 (한 번에 여러 링크를 담아 가져와도 넉넉한 값)
const SOURCE_CALLS_PER_MINUTE = 20;

// 링크만 받아 리스트 이름 · 개수를 먼저 보여 준다 — 저장은 방식을 고른 뒤
export async function previewList(input: string): Promise<ActionResult<ListPreview>> {
  const { userId } = await requireUserId();
  if (!allowCall(`import:${userId}`, SOURCE_CALLS_PER_MINUTE, 60_000)) return { ok: false, error: TOO_FAST, code: "UPSTREAM_ERROR" };
  const link = extractLink(input);
  const source = sourceNameForLink(link);
  if (!source) return { ok: false, error: ERROR_MESSAGE.INVALID_LINK, code: "INVALID_LINK" };
  try {
    const list = await placeSourceFor(source).fetchList(link);
    return {
      ok: true,
      data: { listId: `${source}:${list.sourceListId}`, source, name: list.name, count: list.places.length, unavailable: list.places.filter((p) => !p.available).length },
    };
  } catch (error) {
    return failure(error, source);
  }
}

export async function importList(input: string, mode: ImportMode, visibility?: RatingVisibility): Promise<ActionResult<ImportResult>> {
  const link = extractLink(input);
  const parsedMode = ImportModeSchema.safeParse(mode);
  if (!parsedMode.success) return { ok: false, error: SAVE_FAILED, code: "SAVE_FAILED" };
  if (visibility !== undefined && !(RATING_VISIBILITIES as readonly string[]).includes(visibility)) return { ok: false, error: SAVE_FAILED, code: "SAVE_FAILED" };
  const { supabase, userId } = await requireUserId();
  if (!allowCall(`import:${userId}`, SOURCE_CALLS_PER_MINUTE, 60_000)) return { ok: false, error: TOO_FAST, code: "UPSTREAM_ERROR" };
  const source = sourceNameForLink(link);
  if (!source) return { ok: false, error: ERROR_MESSAGE.INVALID_LINK, code: "INVALID_LINK" };
  try {
    const list = await placeSourceFor(source).fetchList(link);
    const saved = await saveImportedList(supabase, userId, list, parsedMode.data, visibility);
    // 자동 새로 고침을 위해 방식 · 원본 요약을 남긴다
    await recordImportSource(supabase, userId, list, parsedMode.data, visibility);
    return { ok: true, data: saved };
  } catch (error) {
    return failure(error, source);
  }
}

async function requireUserId() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  return { supabase, userId };
}

function failure(error: unknown, source: PlaceSourceName): Extract<ActionResult<never>, { ok: false }> {
  if (error instanceof ImportError) return { ok: false, error: ERROR_MESSAGE[error.code], code: error.code, source };
  if (error instanceof ImportSaveError) return { ok: false, error: SAVE_FAILED, code: "SAVE_FAILED" };
  throw error;
}
