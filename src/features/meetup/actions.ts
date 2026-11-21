"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { PURPOSES } from "@/domain/meetup";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { searchKakaoKeyword } from "@/features/search/kakaoLocal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notifyMeetup } from "./notify";

type Result = { error?: string };
const FAILED = "저장하지 못했어요. 다시 시도해 주세요.";

const CreateInput = z
  .object({ purpose: z.enum(PURPOSES), startsAt: z.iso.datetime({ offset: true }).nullable(), endsAt: z.iso.datetime({ offset: true }).nullable() })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, { message: "끝나는 시간이 시작보다 뒤여야 해요" });

export async function createMeetup(input: z.input<typeof CreateInput>): Promise<Result> {
  const parsed = CreateInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? FAILED };
  const { supabase, me } = await requireUser();
  const { data, error } = await supabase
    .from("meetups")
    .insert({ host_id: me, purpose: parsed.data.purpose, starts_at: parsed.data.startsAt, ends_at: parsed.data.endsAt })
    .select("id")
    .single();
  if (error || !data) return { error: FAILED };
  revalidatePath("/meet");
  redirect(`/meet/${data.id}`, RedirectType.replace);
}

export async function joinMeetup(token: string): Promise<Result> {
  if (!/^[0-9a-f]{24}$/.test(token)) return { error: "열 수 없는 약속이에요" };
  const { supabase, me } = await requireUser();
  const { data, error } = await supabase.rpc("join_meetup", { p_token: token });
  if (error) return { error: error.code === "P0001" ? "정원이 다 찬 약속이에요" : "참여할 수 없는 약속이에요. 링크를 다시 받아 주세요." };
  after(() => notifyMeetup(data as string, me, { kind: "joined" }));
  redirect(`/meet/${data}`, RedirectType.replace);
}

const PointInput = z.object({
  meetupId: z.uuid(),
  kind: z.enum(["origin", "return"]),
  label: z.string().trim().min(1).max(40),
  lat: z.number().min(33).max(39),
  lng: z.number().min(124).max(132),
});

// 좌표는 DB 가 저장 전에 약 1km 로 깎는다
export async function setMeetupPoint(input: z.input<typeof PointInput>): Promise<Result> {
  const parsed = PointInput.safeParse(input);
  if (!parsed.success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const p = parsed.data;
  const { count: before } = await supabase.from("meetup_points").select("kind", { count: "exact", head: true }).eq("meetup_id", p.meetupId).eq("user_id", me);
  const { error } = await supabase
    .from("meetup_points")
    .upsert({ meetup_id: p.meetupId, user_id: me, kind: p.kind, label: p.label, lat: p.lat, lng: p.lng }, { onConflict: "meetup_id,user_id,kind" });
  if (error) return { error: FAILED };
  // 처음 위치를 넣을 때만 알림 — 고칠 때마다 울리지 않게
  if (!before) after(() => notifyMeetup(p.meetupId, me, { kind: "located" }));
  revalidatePath(`/meet/${p.meetupId}`);
  return {};
}

export async function removeMeetupPoint(meetupId: string, kind: "origin" | "return"): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const { error } = await supabase.from("meetup_points").delete().eq("meetup_id", meetupId).eq("user_id", me).eq("kind", kind);
  if (error) return { error: FAILED };
  revalidatePath(`/meet/${meetupId}`);
  return {};
}

export async function closeMeetup(meetupId: string, status: "done" | "cancelled"): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success) return { error: FAILED };
  const { supabase } = await requireUser();
  const { error } = await supabase.from("meetups").update({ status }).eq("id", meetupId);
  if (error) return { error: FAILED };
  // 끝낸 약속의 위치는 바로 지운다 (새벽 정리 작업은 남은 것 정리용)
  await supabase.from("meetup_points").delete().eq("meetup_id", meetupId);
  revalidatePath("/meet");
  // 끝낸 약속은 어디서 만났는지 기록하러
  redirect(status === "done" ? `/meet/${meetupId}/visit` : "/meet", RedirectType.replace);
}

export async function inviteUser(meetupId: string, userId: string): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success || !z.uuid().safeParse(userId).success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const { error } = await supabase.rpc("invite_to_meetup", { p_meetup: meetupId, p_user: userId });
  if (error) return { error: "초대하지 못했어요. 다시 시도해 주세요." };
  after(() => notifyMeetup(meetupId, me, { kind: "invited", to: userId }));
  revalidatePath(`/meet/${meetupId}`);
  return {};
}

export async function respondInvite(meetupId: string, accept: boolean): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const { error } = await supabase.rpc("respond_meetup_invite", { p_meetup: meetupId, p_accept: accept });
  if (error) return { error: error.code === "P0001" ? "정원이 다 찬 약속이에요" : FAILED };
  if (accept) after(() => notifyMeetup(meetupId, me, { kind: "joined" }));
  revalidatePath("/meet");
  if (!accept) redirect("/meet", RedirectType.replace);
  revalidatePath(`/meet/${meetupId}`);
  return {};
}

export type InviteCandidate = { id: string; nickname: string; following: boolean };

// 초대할 사람 — 검색어가 없으면 내가 팔로우하는 사람, 있으면 닉네임 검색
export async function findInvitees(query: string): Promise<InviteCandidate[]> {
  const { supabase, me } = await requireUser();
  const { data: follows } = await supabase.from("follows").select("followee_id").eq("follower_id", me).limit(500);
  const followingIds = new Set(((follows ?? []) as { followee_id: string }[]).map((f) => f.followee_id));
  const q = query.trim().replace(/[%_,()\\]/g, "").slice(0, 20);
  if (!q) {
    if (followingIds.size === 0) return [];
    const { data } = await supabase.from("profiles").select("id, nickname").in("id", [...followingIds]).order("nickname").limit(30);
    return ((data ?? []) as { id: string; nickname: string }[]).map((p) => ({ ...p, following: true }));
  }
  const { data } = await supabase.from("profiles").select("id, nickname").ilike("nickname", `%${q}%`).neq("id", me).limit(20);
  return ((data ?? []) as { id: string; nickname: string }[])
    .map((p) => ({ ...p, following: followingIds.has(p.id) }))
    .sort((a, b) => Number(b.following) - Number(a.following));
}

export type PlaceOption = { label: string; detail: string; lat: number; lng: number };

// 출발지 · 귀가지 찾기 — 역 · 동 이름으로 (카카오 키워드 검색)
export async function searchMeetupPlace(query: string): Promise<PlaceOption[]> {
  const q = query.trim().slice(0, 40);
  if (q.length < 1) return [];
  await requireUser();
  const hits = await searchKakaoKeyword(q, undefined, 8);
  return (hits ?? []).map((h) => ({ label: h.name, detail: h.address, lat: h.lat, lng: h.lng }));
}

// 현재 위치 → 동 이름 (카카오 좌표 → 행정구역). 키가 없거나 실패하면 '현재 위치 근처'
export async function regionNameAt(lat: number, lng: number): Promise<string> {
  await requireUser();
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key || !Number.isFinite(lat) || !Number.isFinite(lng)) return "현재 위치 근처";
  const res = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`, { headers: { Authorization: `KakaoAK ${key}` } }).catch(() => null);
  const body = res?.ok ? ((await res.json().catch(() => null)) as { documents?: { region_type: string; region_2depth_name: string; region_3depth_name: string }[] } | null) : null;
  const doc = body?.documents?.find((d) => d.region_type === "H") ?? body?.documents?.[0];
  return doc ? `${doc.region_2depth_name} ${doc.region_3depth_name}`.trim() : "현재 위치 근처";
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  return { supabase, me };
}
