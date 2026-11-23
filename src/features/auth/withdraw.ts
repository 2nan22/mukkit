"use server";

import { redirect, RedirectType } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNED_OUT_HOME } from "./paths";

export type WithdrawState = { error?: string };

const BUCKET = "rating-media";
const CONFIRM_WORD = "탈퇴";
const FAILED = "탈퇴하지 못했어요. 잠시 뒤 다시 시도해 주세요.";

// 탈퇴 — 사진 · 영상 파일을 먼저 지우고(Storage 는 SQL 로 못 지운다) 계정을 지운다. 나머지 기록은 연쇄 삭제
export async function withdraw(_prev: WithdrawState, formData: FormData): Promise<WithdrawState> {
  if (String(formData.get("confirm") ?? "").trim() !== CONFIRM_WORD) return { error: `'${CONFIRM_WORD}'를 입력해 주세요` };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME, RedirectType.replace);

  const paths = await listMyFiles(supabase, me);
  if (paths === null) return { error: FAILED };
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) return { error: FAILED };
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: FAILED };
  await supabase.auth.signOut();
  redirect("/?bye=1", RedirectType.replace);
}

// <나>/<장소>/<파일> — 평가에 붙지 않은 채 올라간 파일까지 폴더째 찾는다
async function listMyFiles(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, me: string): Promise<string[] | null> {
  const bucket = supabase.storage.from(BUCKET);
  const folders = await listAll(bucket, me);
  if (!folders) return null;
  const paths: string[] = [];
  for (const folder of folders) {
    const files = await listAll(bucket, `${me}/${folder}`);
    if (!files) return null;
    paths.push(...files.map((f) => `${me}/${folder}/${f}`));
  }
  return paths;
}

// Storage 목록은 한 번에 1000개까지 — 장소가 1000곳을 넘어도 폴더를 모두 찾게 쪽을 넘긴다
async function listAll(bucket: ReturnType<Awaited<ReturnType<typeof createSupabaseServerClient>>["storage"]["from"]>, prefix: string): Promise<string[] | null> {
  const names: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await bucket.list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) return null;
    names.push(...(data ?? []).map((f) => f.name));
    if (!data || data.length < 1000) return names;
  }
}
