import type { SupabaseClient } from "@supabase/supabase-js";

// 앱 안 알림함 — 받는 사람만 · 차단한 사이 · 볼 수 없게 된 평가 알림은 함수가 거른다
export type NotificationKind = "comment" | "like" | "follow" | "meetup_invite" | "meetup_join" | "meetup_ready" | "meetup_cancel" | "meetup_course" | "visit_tag";
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
  // 추천 지역 알림 — 넣은 위치 종류 · 처음 나왔는지 (66)
  pointKind: "origin" | "return" | null;
  firstReady: boolean;
  // 취소된 약속의 시각 — 약속은 지워져 이것만 남는다 (93)
  meetupStartsAt: string | null;
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
    pointKind: (r.point_kind as "origin" | "return" | null) ?? null,
    firstReady: Boolean(r.first_ready),
    meetupStartsAt: (r.meetup_starts_at as string) ?? null,
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
    case "meetup_ready":
    case "meetup_course":
    case "meetup_cancel":
      return n.meetupId ? `/meet/${n.meetupId}` : "/meet";
    case "visit_tag":
      return "/visits";
  }
}

// 같은 평가의 댓글 · 좋아요는 한 줄로 — 최근 것 하나를 대표로, 함께 묶인 수와 다른 사람 수를 붙인다
export type GroupedNotification = AppNotification & { count: number; otherActors: number };

export function groupNotifications(items: AppNotification[]): GroupedNotification[] {
  const out: GroupedNotification[] = [];
  const byKey = new Map<string, { row: GroupedNotification; actors: Set<string> }>();
  for (const n of items) {
    const key = (n.kind === "comment" || n.kind === "like") && n.ownerId && n.placeId ? `${n.kind}:${n.ownerId}:${n.placeId}` : null;
    const hit = key ? byKey.get(key) : undefined;
    if (hit) {
      hit.row.count += 1;
      hit.actors.add(n.actorId);
      hit.row.otherActors = hit.actors.size - 1;
      if (!n.read) hit.row.read = false;
      continue;
    }
    const row = { ...n, count: 1, otherActors: 0 };
    out.push(row);
    if (key) byKey.set(key, { row, actors: new Set([n.actorId]) });
  }
  return out;
}
