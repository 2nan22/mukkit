import type { SupabaseClient } from "@supabase/supabase-js";
import { planAreaShops, rankAreas, type AreaScore, type Purpose, type RankedArea } from "@/domain/meetup";
import type { Scored } from "@/domain/eatScore";
import { getEatCandidates, getMyTasteBasis } from "@/features/eat/eat";

export type MeetupStatus = {
  id: string;
  purpose: Purpose;
  status: "open" | "done" | "cancelled";
  inviteToken: string | null;
  expiresAt: string;
  startsAt: string | null;
  endsAt: string | null;
  isHost: boolean;
  partner: { id: string; nickname: string } | null;
  meReady: boolean;
  partnerReady: boolean;
};
export type MyPoint = { kind: "origin" | "return"; label: string };
export type MeetupListItem = { id: string; purpose: Purpose; status: string; startsAt: string | null; partnerNickname: string | null; isHost: boolean };
export type AreaPlan = RankedArea & { shops: Scored[] };

type StatusRow = {
  meetup_id: string; purpose: Purpose; status: MeetupStatus["status"]; invite_token: string | null; expires_at: string;
  starts_at: string | null; ends_at: string | null; is_host: boolean; partner_id: string | null; partner_nickname: string | null;
  me_ready: boolean; partner_ready: boolean;
};

export async function getMeetupStatus(supabase: SupabaseClient, id: string): Promise<MeetupStatus | null> {
  const { data, error } = await supabase.rpc("meetup_status", { p_meetup: id });
  if (error || !data?.[0]) return null;
  const r = data[0] as StatusRow;
  return {
    id: r.meetup_id,
    purpose: r.purpose,
    status: r.status,
    inviteToken: r.invite_token,
    expiresAt: r.expires_at,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    isHost: r.is_host,
    partner: r.partner_id && r.partner_nickname ? { id: r.partner_id, nickname: r.partner_nickname } : null,
    meReady: r.me_ready,
    partnerReady: r.partner_ready,
  };
}

export async function getMyPoints(supabase: SupabaseClient, meetupId: string): Promise<MyPoint[]> {
  const { data } = await supabase.from("meetup_points").select("kind, label").eq("meetup_id", meetupId);
  return (data ?? []) as MyPoint[];
}

type ListRow = {
  id: string; purpose: Purpose; status: string; starts_at: string | null; host_id: string;
  host: { nickname: string } | null; guest: { nickname: string } | null;
};

export async function getMyMeetups(supabase: SupabaseClient, me: string): Promise<MeetupListItem[]> {
  const { data } = await supabase
    .from("meetups")
    .select("id, purpose, status, starts_at, host_id, host:profiles!meetups_host_id_fkey(nickname), guest:profiles!meetups_guest_id_fkey(nickname)")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  return ((data ?? []) as unknown as ListRow[]).map((r) => ({
    id: r.id,
    purpose: r.purpose,
    status: r.status,
    startsAt: r.starts_at,
    isHost: r.host_id === me,
    partnerNickname: r.host_id === me ? (r.guest?.nickname ?? null) : (r.host?.nickname ?? null),
  }));
}

type AreaRow = { name: string; lat: number; lng: number; my_minutes: number; partner_minutes: number; my_return: number | null; partner_return: number | null; recent: number };

// 둘 다 위치를 넣었을 때 — 지역 3곳(막차 고려) · 지역마다 가게
export async function planMeetup(supabase: SupabaseClient, me: string, status: MeetupStatus): Promise<AreaPlan[]> {
  const { data, error } = await supabase.rpc("meetup_area_scores", { p_meetup: status.id, p_limit: 10 });
  if (error) throw new Error(`약속 지역 계산 실패: ${error.code}`);
  const areas: AreaScore[] = ((data ?? []) as AreaRow[]).map((r) => ({
    name: r.name, lat: r.lat, lng: r.lng, myMinutes: r.my_minutes, partnerMinutes: r.partner_minutes,
    myReturn: r.my_return, partnerReturn: r.partner_return, recent: r.recent,
  }));
  const ranked = rankAreas(areas, status.endsAt ? new Date(status.endsAt) : null, 3);
  const { pref } = await getMyTasteBasis(supabase, me);
  return Promise.all(
    ranked.map(async (a) => {
      const candidates = await getEatCandidates(supabase, a.lat, a.lng, 1000).catch(() => []);
      return { ...a, shops: planAreaShops(candidates, a, status.purpose, pref, status.partner) };
    }),
  );
}
