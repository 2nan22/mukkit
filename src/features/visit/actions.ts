"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { after } from "next/server";
import { getMeetupStatus } from "@/features/meetup/meetup";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyVisitTag } from "./notify";
import { getMyVisits, syncMyVisit } from "./visit";

type Result = { error?: string };

// 받은 태그 수락 · 거절 — 수락하면 내 등급을 남기러 평가 화면으로
export async function respondVisit(visitId: string, accept: boolean, showInFeed: boolean): Promise<Result> {
  if (!z.uuid().safeParse(visitId).success) return { error: "처리하지 못했어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const { data: placeId, error } = await supabase.rpc("respond_visit", { p_visit: visitId, p_accept: accept, p_show_in_feed: showInFeed });
  if (error) return { error: "이미 처리했거나 없어진 기록이에요." };
  revalidatePath("/", "layout");
  if (accept) redirect(`/rate/${placeId}?next=/visits`, RedirectType.push);
  return {};
}

function kstDate(iso: string | null): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(iso ? new Date(iso) : new Date());
}

// 끝낸 약속을 방문 기록으로 — 고른 가게를 저장하고 다른 참여자를 함께 간 사람으로 요청
export async function recordMeetupVisit(meetupId: string, placeId: string): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success || !z.uuid().safeParse(placeId).success) return { error: "기록하지 못했어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const status = await getMeetupStatus(supabase, meetupId);
  if (!status?.isMember) return { error: "참여한 약속만 기록할 수 있어요." };
  const visitedOn = kstDate(status.startsAt);
  const { error: saveError } = await supabase.from("user_places").upsert({ user_id: me, place_id: placeId, visited_on: visitedOn }, { onConflict: "user_id,place_id", ignoreDuplicates: true });
  if (saveError) return { error: "기록하지 못했어요. 다시 시도해 주세요." };
  // 이미 저장한 가게면 비어 있는 방문일만 약속 날짜로 채운다
  await supabase.from("user_places").update({ visited_on: visitedOn }).eq("user_id", me).eq("place_id", placeId).is("visited_on", null);
  // 이 가게에 이미 내가 만든 방문이 있으면 그 사람들에 더한다
  const existing = (await getMyVisits(supabase, placeId)).find((v) => v.isCreator);
  const keepUsers = (existing?.members ?? []).flatMap((m) => (m.userId ? [m.userId] : []));
  const keepGuests = (existing?.members ?? []).flatMap((m) => (m.guest ? [m.nickname] : []));
  const others = status.members.filter((m) => !m.isMe).map((m) => m.id);
  try {
    const { invited } = await syncMyVisit(
      supabase, me, placeId, existing?.visitedOn ?? visitedOn,
      { userIds: [...keepUsers, ...others], guests: keepGuests, showInFeed: existing?.myShowInFeed ?? true },
      meetupId,
    );
    if (invited.length) after(() => notifyVisitTag(me, invited));
  } catch {
    return { error: "기록하지 못했어요. 다시 시도해 주세요." };
  }
  revalidatePath("/", "layout");
  redirect(`/rate/${placeId}?next=/meet`, RedirectType.replace);
}
