import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { honor } from "@/domain/honor";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getNotifications, notificationHref, type AppNotification } from "@/features/notifications/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "알림" };

export default function NotificationsPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" title="알림" fallback="/home" />
      <main className="flex flex-1 flex-col">
        <Suspense fallback={<ListSkeleton />}>
          <List />
        </Suspense>
      </main>
    </div>
  );
}

function message(n: AppNotification): string {
  const who = honor(n.actorNickname);
  const place = n.placeName ? `${n.placeName} ` : "";
  switch (n.kind) {
    case "comment":
      return `${who}이 ${place}평가에 댓글을 남겼어요`;
    case "like":
      return `${who}이 ${place}평가를 좋아해요`;
    case "follow":
      return `${who}이 나를 팔로우해요`;
    case "meetup_invite":
      return `${who}이 약속에 초대했어요`;
    case "meetup_join":
      return `${who}이 약속에 들어왔어요`;
    case "visit_tag":
      return `${who}이 ${place}에 함께 갔다고 남겼어요`;
  }
}

function timeLabel(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  if (min < 60 * 24) return `${Math.floor(min / 60)}시간 전`;
  if (min < 60 * 24 * 7) return `${Math.floor(min / 1440)}일 전`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

async function List() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const items = await getNotifications(supabase);
  // 보여 준 것은 읽음으로 — 이번 화면에는 안 읽음 표시를 남긴다
  if (items.some((n) => !n.read)) await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me).is("read_at", null);

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 pb-24 text-center">
        <span className="text-body font-semibold">아직 알림이 없어요</span>
        <span className="text-meta text-muted">댓글 · 좋아요 · 팔로우 · 약속 초대가 오면 여기에 모여요.</span>
      </div>
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((n) => (
        <li key={n.id}>
          <Link href={notificationHref(n)} className={`flex min-h-16 items-center gap-3 px-5 py-3 ${n.read ? "" : "bg-brand-soft/60"}`}>
            <Avatar name={n.actorNickname} size={40} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body leading-snug text-ink">{message(n)}</span>
              <span className="text-meta text-muted" suppressHydrationWarning>
                {timeLabel(n.createdAt)}
              </span>
            </span>
            {!n.read && (
              <span className="size-2 shrink-0 rounded-full bg-brand">
                <span className="sr-only">안 읽음</span>
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
