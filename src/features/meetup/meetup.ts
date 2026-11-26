import type { SupabaseClient } from "@supabase/supabase-js";
import { planAreaShops, rankAreas, type AreaPerson, type AreaScore, type Purpose, type RankedArea } from "@/domain/meetup";
import type { Scored } from "@/domain/eatScore";
import { getEatCandidates, getMyTasteBasis } from "@/features/eat/eat";

export type MeetupMember = { id: string; nickname: string; isHost: boolean; isMe: boolean; ready: boolean };
export type MeetupStatus = {
  id: string;
  purpose: Purpose;
  status: "open" | "done" | "cancelled";
  inviteToken: string | null;
  expiresAt: string;
  startsAt: string | null;
  endsAt: string | null;
  maxMembers: number;
  isHost: boolean;
  isMember: boolean;
  isInvitee: boolean;
  hostNickname: string;
  meReady: boolean;
  members: MeetupMember[];
  invitees: { id: string; nickname: string }[];
};
export type MyPoint = { kind: "origin" | "return"; label: string };
export type MeetupListItem = { id: string; purpose: Purpose; status: string; startsAt: string | null; hostNickname: string; others: string[]; invited: boolean };
export type AreaPlan = RankedArea & { shops: Scored[] };

type StatusRow = {
  meetup_id: string; purpose: Purpose; status: MeetupStatus["status"]; invite_token: string | null; expires_at: string;
  starts_at: string | null; ends_at: string | null; max_members: number; is_host: boolean; is_member: boolean; is_invitee: boolean;
  host_nickname: string; me_ready: boolean; members: MeetupMember[]; invitees: { id: string; nickname: string }[];
};

export async function getMeetupStatus(supabase: SupabaseClient, id: string): Promise<MeetupStatus | null> {
  const { data, error } = await supabase.rpc("meetup_status", { p_meetup: id });
  if (error || !data?.[0]) return null;
  const r = data[0] as StatusRow;
  return {
    id: r.meetup_id, purpose: r.purpose, status: r.status, inviteToken: r.invite_token, expiresAt: r.expires_at,
    startsAt: r.starts_at, endsAt: r.ends_at, maxMembers: r.max_members, isHost: r.is_host, isMember: r.is_member,
    isInvitee: r.is_invitee, hostNickname: r.host_nickname, meReady: r.me_ready, members: r.members, invitees: r.invitees,
  };
}

export async function getMyPoints(supabase: SupabaseClient, meetupId: string): Promise<MyPoint[]> {
  const { data } = await supabase.from("meetup_points").select("kind, label").eq("meetup_id", meetupId);
  return (data ?? []) as MyPoint[];
}

type ListRow = { id: string; purpose: Purpose; status: string; starts_at: string | null; host_id: string; host: { nickname: string } | null };

export async function getMyMeetups(supabase: SupabaseClient, me: string): Promise<MeetupListItem[]> {
  const { data } = await supabase
    .from("meetups")
    .select("id, purpose, status, starts_at, host_id, host:profiles!meetups_host_id_fkey(nickname)")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  const rows = (data ?? []) as unknown as ListRow[];
  if (rows.length === 0) return [];
  // 참여자 이름 (참여 중인 약속만 보임) · 받은 초대
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("meetup_members").select("meetup_id, user_id, profiles(nickname)").in("meetup_id", rows.map((r) => r.id)),
    supabase.from("meetup_invites").select("meetup_id").eq("user_id", me),
  ]);
  const byMeetup = new Map<string, string[]>();
  for (const m of (members ?? []) as unknown as { meetup_id: string; user_id: string; profiles: { nickname: string } | null }[]) {
    if (m.user_id === me || !m.profiles) continue;
    byMeetup.set(m.meetup_id, [...(byMeetup.get(m.meetup_id) ?? []), m.profiles.nickname]);
  }
  const invited = new Set(((invites ?? []) as { meetup_id: string }[]).map((i) => i.meetup_id));
  return rows.map((r) => ({
    id: r.id, purpose: r.purpose, status: r.status, startsAt: r.starts_at,
    hostNickname: r.host?.nickname ?? "", others: byMeetup.get(r.id) ?? [], invited: invited.has(r.id),
  }));
}

type AreaRow = { name: string; lat: number; lng: number; people: AreaPerson[]; max_minutes: number; avg_minutes: number; recent: number; station_name: string | null };

// 위치를 넣은 참여자가 2명 이상일 때 — 지역 3곳(막차 고려) · 지역마다 가게
export async function planMeetup(supabase: SupabaseClient, me: string, status: MeetupStatus): Promise<AreaPlan[]> {
  const { data, error } = await supabase.rpc("meetup_area_scores", { p_meetup: status.id, p_limit: 10 });
  if (error) throw new Error(`약속 지역 계산 실패: ${error.code}`);
  const areas: AreaScore[] = ((data ?? []) as AreaRow[]).map((r) => ({
    name: r.name, lat: r.lat, lng: r.lng, people: r.people, maxMinutes: r.max_minutes, avgMinutes: r.avg_minutes, recent: r.recent, station: r.station_name,
  }));
  const ranked = rankAreas(areas, status.endsAt ? new Date(status.endsAt) : null, 3);
  const { pref } = await getMyTasteBasis(supabase, me);
  const companions = status.members.filter((m) => !m.isMe).map((m) => ({ id: m.id, nickname: m.nickname }));
  return Promise.all(
    ranked.map(async (a) => {
      const candidates = await getEatCandidates(supabase, a.lat, a.lng, 1000).catch(() => []);
      return { ...a, shops: planAreaShops(candidates, a, status.purpose, pref, companions) };
    }),
  );
}

// 만날 곳 (86) — 참여자 모두에게 보임. 없으면 null (화면이 추천 지역 대표 역을 권함)
export type MeetPoint = { label: string; lat: number; lng: number; area: string | null };
export async function getMeetPoint(supabase: SupabaseClient, meetupId: string): Promise<MeetPoint | null> {
  const { data } = await supabase.from("meetups").select("meet_label, meet_lat, meet_lng, meet_area").eq("id", meetupId).maybeSingle();
  const r = data as { meet_label: string | null; meet_lat: number | null; meet_lng: number | null; meet_area: string | null } | null;
  return r?.meet_label && r.meet_lat !== null && r.meet_lng !== null ? { label: r.meet_label, lat: r.meet_lat, lng: r.meet_lng, area: r.meet_area } : null;
}
