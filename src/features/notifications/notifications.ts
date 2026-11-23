import type { SupabaseClient } from "@supabase/supabase-js";

// 앱 안 알림함 — 받는 사람만 · 차단한 사이 · 볼 수 없게 된 평가 알림은 함수가 거른다
export type NotificationKind = "comment" | "like" | "follow" | "meetup_invite" | "meetup_join" | "visit_tag";
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  actorId: string;
  actorNickname: string;
  ownerId: string | null;
  placeId: string | null;
  placeName: string | null;
  meetupId: string | null;
  visitId: string | null;
  createdAt: string;
  read: boolean;
};

export async function getNotifications(supabase: SupabaseClient): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc("my_notifications", { p_limit: 60 });
  if (error) throw new Error(`알림 조회 실패: ${error.code}`);
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    kind: r.kind as NotificationKind,
    actorId: r.actor_id as string,
    actorNickname: r.actor_nickname as string,
    ownerId: (r.owner_id as string) ?? null,
    placeId: (r.place_id as string) ?? null,
    placeName: (r.place_name as string) ?? null,
    meetupId: (r.meetup_id as string) ?? null,
    visitId: (r.visit_id as string) ?? null,
    createdAt: r.created_at as string,
    read: r.read as boolean,
  }));
}

export async function getUnreadCount(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.rpc("unread_notifications");
  return (data as number | null) ?? 0;
}

// 알림을 누르면 갈 곳
export function notificationHref(n: AppNotification): string {
  switch (n.kind) {
    case "comment":
    case "like":
      return n.ownerId && n.placeId ? `/p/${n.placeId}/r/${n.ownerId}` : "/home";
    case "follow":
      return `/u/${n.actorId}`;
    case "meetup_invite":
    case "meetup_join":
      return n.meetupId ? `/meet/${n.meetupId}` : "/meet";
    case "visit_tag":
      return "/visits";
  }
}
