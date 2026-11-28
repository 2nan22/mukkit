import type { SupabaseClient } from "@supabase/supabase-js";
import { PURPOSE_LABEL, type Purpose } from "@/domain/meetup";
import { meetShort } from "@/domain/meetTime";

// 홈 약속 칸 (96) — 답하지 않은 초대 · 다음 약속
export type HomeMeetup = {
  invites: { count: number; meetupId: string | null; host: string | null };
  next: { id: string; title: string | null; purpose: Purpose; startsAt: string | null; people: number } | null;
};

type InviteRow = { meetup_id: string; meetups: { host: { nickname: string } | null } | null };
type MemberRow = { meetup_id: string; meetups: { id: string; title: string | null; purpose: Purpose; starts_at: string | null; ends_at: string | null; meetup_members: { count: number }[] } | null };

// 끝난 지(끝 시각 없으면 시작 시각부터) 3시간 안 약속까지는 '진행 중'으로 둔다 — 만나는 중에 홈을 열어도 보이게
const GRACE_MS = 3 * 3600_000;

export async function getHomeMeetup(supabase: SupabaseClient, me: string, now = Date.now()): Promise<HomeMeetup> {
  const nowIso = new Date(now).toISOString();
  const [invites, mine] = await Promise.all([
    supabase
      .from("meetup_invites")
      .select("meetup_id, meetups!inner(status, expires_at, host:profiles!meetups_host_id_fkey(nickname))", { count: "exact" })
      .eq("user_id", me)
      .eq("meetups.status", "open")
      .gt("meetups.expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<InviteRow[]>(),
    supabase
      .from("meetup_members")
      .select("meetup_id, meetups!inner(id, title, purpose, starts_at, ends_at, status, expires_at, meetup_members(count))")
      .eq("user_id", me)
      .eq("meetups.status", "open")
      .gt("meetups.expires_at", nowIso)
      .limit(50)
      .returns<MemberRow[]>(),
  ]);
  const first = invites.data?.[0];
  const open = (mine.data ?? []).flatMap((r) => (r.meetups ? [r.meetups] : []));
  // 시각이 정해진 가까운 약속 먼저, 시간 미정은 그 뒤
  const upcoming = open
    .filter((m) => !m.starts_at || new Date(m.ends_at ?? m.starts_at).getTime() > now - GRACE_MS)
    .sort((a, b) => (a.starts_at ? new Date(a.starts_at).getTime() : Infinity) - (b.starts_at ? new Date(b.starts_at).getTime() : Infinity))[0];
  const people = upcoming?.meetup_members?.[0]?.count ?? 0;
  return {
    invites: { count: invites.count ?? 0, meetupId: first?.meetup_id ?? null, host: first?.meetups?.host?.nickname ?? null },
    next: upcoming ? { id: upcoming.id, title: upcoming.title, purpose: upcoming.purpose, startsAt: upcoming.starts_at, people } : null,
  };
}

export type ActionTile = { href: string; icon: "eat" | "people" | "mail" | "calendar"; title: string; sub: string; primary: boolean };

// 두 칸 (96, E2) — 주황은 하나: 답하지 않은 초대가 있으면 약속 칸, 아니면 뭐 먹지 · 저장 0곳이면 가져오기 카드가 주황이라 둘 다 테두리
export function homeTiles({ meetup, wantToGo, empty, now = Date.now() }: { meetup: HomeMeetup; wantToGo: number; empty: boolean; now?: number }): [ActionTile, ActionTile] {
  const invited = meetup.invites.count > 0;
  const eat: ActionTile = {
    href: "/eat",
    icon: "eat",
    title: "여기서 뭐 먹지",
    sub: wantToGo > 0 ? "가고 싶은 곳에서 골라요" : "아는 사람 평가에서 골라요",
    primary: !empty && !invited,
  };
  let meet: ActionTile;
  if (invited) {
    meet = {
      href: meetup.invites.count === 1 && meetup.invites.meetupId ? `/meet/${meetup.invites.meetupId}` : "/meet",
      icon: "mail",
      title: "약속 초대 보기",
      sub: meetup.invites.count > 1 ? `받은 초대 ${meetup.invites.count}개` : meetup.invites.host ? `${meetup.invites.host}님이 보냈어요` : "받은 초대 1개",
      primary: !empty,
    };
  } else if (meetup.next) {
    const n = meetup.next;
    const when = meetShort(n.startsAt, now);
    const others = Math.max(0, n.people - 1);
    meet = {
      href: `/meet/${n.id}`,
      icon: "calendar",
      title: n.title ?? (when ? `${when.day} ${when.part} 약속` : `${PURPOSE_LABEL[n.purpose]} 약속`),
      sub: `${when ? (n.title ? `${when.day} ${when.part} ${when.clock}` : when.clock) : "시간 미정"}, ${others > 0 ? `${others}명과 함께` : "아직 혼자예요"}`,
      primary: false,
    };
  } else {
    meet = { href: "/meet/new", icon: "people", title: "약속 잡기", sub: "만날 곳 함께 정하기", primary: false };
  }
  return [eat, meet];
}
