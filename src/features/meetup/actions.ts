"use server";

import { timedFetch } from "@/lib/http/timedFetch";
import { getMyProfileFlags } from "@/features/profile/flags";
import { needsAgreement } from "@/features/legal/legal";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";
import { PURPOSES } from "@/domain/meetup";
import { NICKNAME_SETUP, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { searchKakaoKeyword } from "@/features/search/kakaoLocal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/features/safety/safety";
import { notifyCourseChanged, notifyMeetup, notifyMeetupCancelled } from "./notify";
import { refreshCourseRoute } from "./courseRoute";
import { COURSE_MAX } from "@/domain/course";

type Result = { error?: string };
const FAILED = "저장하지 못했어요. 다시 시도해 주세요.";

const CreateInput = z
  .object({
    purpose: z.enum(PURPOSES),
    startsAt: z.iso.datetime({ offset: true }).nullable(),
    endsAt: z.iso.datetime({ offset: true }).nullable(),
    // 정해 둔 만날 곳 (92) — 없으면 각자 출발지로 지역 추천
    meet: z.object({ label: z.string().trim().min(1).max(40), lat: z.number().min(33).max(39), lng: z.number().min(124).max(132) }).nullable().optional(),
  })
  .refine((v) => !v.startsAt || !v.endsAt || v.endsAt > v.startsAt, { message: "끝나는 시간이 시작보다 뒤여야 해요" })
  // 지난 시각으로는 만들지 않는다 — 화면을 오래 켜 둔 경우 (몇 분 여유)
  .refine((v) => !v.startsAt || new Date(v.startsAt).getTime() > Date.now() - 10 * 60_000, { message: "이미 지난 시각이에요. 다시 골라 주세요" });

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
  const meet = parsed.data.meet;
  if (meet) {
    // 약속은 이미 만들어졌으니 실패해도 막지 않는다 — 약속 화면에서 다시 정할 수 있음
    const { error: meetError } = await supabase.rpc("set_meet_point", { p_meetup: data.id, p_label: meet.label.slice(0, 40), p_lat: meet.lat, p_lng: meet.lng, p_area: null });
    if (meetError) console.warn("[meetup] 만날 곳 저장 실패: code=%s", meetError.code);
  }
  revalidatePath("/meet");
  // 만든 뒤 바로 초대 화면 (67)
  redirect(`/meet/${data.id}/invite?created=1`, RedirectType.replace);
}

export async function joinMeetup(token: string): Promise<Result> {
  if (!/^[0-9a-f]{24}$/.test(token)) return { error: "열 수 없는 약속이에요" };
  const { supabase, me } = await requireUser();
  // 닉네임 · 약관 전이면 그 단계를 마치고 이 초대로 돌아오게 — 이름 없는 참여자가 생기지 않게
  const flags = await getMyProfileFlags(supabase);
  const back = `?next=${encodeURIComponent(`/m/${token}`)}`;
  if (!flags?.nickname_set_at) redirect(NICKNAME_SETUP + back);
  if (needsAgreement(flags)) redirect("/onboarding/terms" + back);
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
  if (!before) after(() => notifyMeetup(p.meetupId, me, { kind: "located", point: p.kind }));
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

// 약속 끝내기 — 함께하는 사람 누구나. 위치는 바로 지우고 어디서 만났는지 기록하러
export async function closeMeetup(meetupId: string): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success) return { error: FAILED };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("finish_meetup", { p_meetup: meetupId });
  if (error) return { error: error.code === "P0002" ? "이미 끝났거나 취소된 약속이에요" : FAILED };
  revalidatePath("/meet");
  redirect(`/meet/${meetupId}/visit`, RedirectType.replace);
}

// 약속 취소 — 만든 사람만, 약속을 지운다(초대 · 참여 · 위치 · 코스 · 알림 함께, 90). 함께하던 사람 · 초대받은 사람에게 푸시
export async function cancelMeetup(meetupId: string): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const { data, error } = await supabase.rpc("cancel_meetup", { p_meetup: meetupId });
  if (error) return { error: error.code === "P0002" ? "이미 끝난 약속이에요" : FAILED };
  const to = ((data ?? []) as string[]).filter(Boolean);
  if (to.length > 0) after(() => notifyMeetupCancelled(meetupId, me, to));
  revalidatePath("/meet");
  revalidatePath("/home");
  redirect("/meet", RedirectType.replace);
}

// 약속 나가기 — 함께하던 사람(만든 사람 말고). 내 참여 · 위치만 지운다 (90)
export async function leaveMeetup(meetupId: string): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success) return { error: FAILED };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_meetup", { p_meetup: meetupId });
  if (error) return { error: error.code === "P0002" ? "이미 끝난 약속이에요" : FAILED };
  revalidatePath("/meet");
  revalidatePath("/home");
  redirect("/meet", RedirectType.replace);
}

export async function inviteUser(meetupId: string, userId: string): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success || !z.uuid().safeParse(userId).success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const { error } = await supabase.rpc("invite_to_meetup", { p_meetup: meetupId, p_user: userId });
  if (error) return { error: error.code === "42501" ? "초대할 수 없는 사람이에요." : "초대하지 못했어요. 다시 시도해 주세요." };
  after(() => notifyMeetup(meetupId, me, { kind: "invited", to: userId }));
  revalidatePath(`/meet/${meetupId}`);
  return {};
}

export async function respondInvite(meetupId: string, accept: boolean): Promise<Result> {
  if (!z.uuid().safeParse(meetupId).success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const { error } = await supabase.rpc("respond_meetup_invite", { p_meetup: meetupId, p_accept: accept });
  if (error) return { error: error.code === "P0001" ? "정원이 다 찬 약속이에요" : error.code === "42501" ? "취소된 약속이에요" : FAILED };
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
  const [{ data: follows }, blocked] = await Promise.all([supabase.from("follows").select("followee_id").eq("follower_id", me).limit(500), getBlockedIds(supabase)]);
  const followingIds = new Set(((follows ?? []) as { followee_id: string }[]).map((f) => f.followee_id));
  const q = query.trim().replace(/[%_,()\\]/g, "").slice(0, 20);
  if (!q) {
    if (followingIds.size === 0) return [];
    const { data } = await supabase.from("profiles").select("id, nickname").in("id", [...followingIds]).order("nickname").limit(30);
    return ((data ?? []) as { id: string; nickname: string }[]).filter((p) => !blocked.has(p.id)).map((p) => ({ ...p, following: true }));
  }
  const { data } = await supabase.from("profiles").select("id, nickname").ilike("nickname", `%${q}%`).neq("id", me).limit(20);
  return ((data ?? []) as { id: string; nickname: string }[])
    .filter((p) => !blocked.has(p.id))
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
  const res = await timedFetch(`https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`, { headers: { Authorization: `KakaoAK ${key}` } }).catch(() => null);
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

const CourseInput = z.object({ meetupId: z.uuid(), placeIds: z.array(z.uuid()).max(COURSE_MAX), expected: z.string().max(200).nullable() });

// 코스를 통째로 바꾼다 (84) — 담기 · 빼기 · 순서 바꾸기 모두. expected: 앱이 보던 순서(그 사이 남이 바꿨으면 거절)
// 실제로 바뀌었을 때만 걷는 길을 한 번 받아 저장
export async function setMeetupCourse(input: z.input<typeof CourseInput>): Promise<Result & { conflict?: boolean }> {
  const parsed = CourseInput.safeParse(input);
  if (!parsed.success) return { error: FAILED };
  const { supabase, me } = await requireUser();
  const { meetupId, placeIds, expected } = parsed.data;
  const { data: changed, error } = await supabase.rpc("set_meetup_course", { p_meetup: meetupId, p_places: placeIds, p_expected: expected });
  if (error) {
    if (error.code === "P0001") return { error: `코스는 ${COURSE_MAX}곳까지 담을 수 있어요` };
    if (error.code === "P0002") return { error: "끝난 약속이에요" };
    if (error.code === "P0003") {
      revalidatePath(`/meet/${meetupId}`);
      revalidatePath(`/meet/${meetupId}/course`);
      return { error: "다른 분이 코스를 바꿨어요. 새로 불러왔어요.", conflict: true };
    }
    return { error: FAILED };
  }
  // 저장 한 번에 길 한 번 — 코스 화면은 '이 순서로 저장'을 눌렀을 때만 여기로 (88-3)
  if (changed) {
    await refreshCourseRoute(meetupId).catch(() => false);
    after(() => notifyCourseChanged(meetupId, me));
  }
  revalidatePath(`/meet/${meetupId}`);
  revalidatePath(`/meet/${meetupId}/course`);
  return {};
}

const MeetPointInput = z.object({
  meetupId: z.uuid(),
  point: z
    .object({ label: z.string().trim().min(1).max(40), lat: z.number().min(33).max(39), lng: z.number().min(124).max(132), area: z.string().max(40).nullable() })
    .nullable(),
});

// 만날 곳 정하기 · 지우기 (86) — DB 함수가 참여자 · 진행 중 · 실제 지역 이름을 확인
export async function setMeetPoint(input: z.input<typeof MeetPointInput>): Promise<Result> {
  const parsed = MeetPointInput.safeParse(input);
  if (!parsed.success) return { error: FAILED };
  const { supabase } = await requireUser();
  const { meetupId, point } = parsed.data;
  const { error } = await supabase.rpc("set_meet_point", {
    p_meetup: meetupId,
    p_label: point?.label ?? null,
    p_lat: point?.lat ?? null,
    p_lng: point?.lng ?? null,
    p_area: point?.area ?? null,
  });
  if (error) return { error: error.code === "P0002" ? "끝난 약속이에요" : FAILED };
  // 응답을 기다리게 하지 않음 — 화면은 어림으로 먼저, 새로 불러올 때 실제 길 (MeetupRefresher)
  if (point) after(() => refreshCourseRoute(meetupId).catch(() => false));
  revalidatePath(`/meet/${meetupId}`);
  return {};
}
