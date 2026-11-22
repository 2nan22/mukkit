import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { honor } from "@/domain/honor";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getNotifications, notificationHref, type AppNotification } from "@/features/notifications/notifications";
import { MarkRead } from "@/features/notifications/MarkRead";
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
  const rating = n.placeName ? `내 ${n.placeName} 평가` : "내 평가";
  switch (n.kind) {
    case "comment":
      return `${who}이 ${rating}에 댓글을 남겼어요`;
    case "like":
      return `${who}이 ${rating}를 좋아해요`;
    case "follow":
      return `${who}이 나를 팔로우하기 시작했어요`;
    case "meetup_invite":
      return `${who}이 약속에 초대했어요`;
    case "meetup_join":
      return `${who}이 약속에 참여했어요`;
    case "visit_tag":
      return n.placeName ? `${who}이 ${n.placeName}에 함께 갔다고 남겼어요` : `${who}이 함께 갔다고 남겼어요`;
  }
}

function isToday(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
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

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 pb-24 text-center">
        <span className="text-body font-semibold">아직 알림이 없어요</span>
        <span className="text-meta text-muted">댓글 · 좋아요 · 팔로우 · 약속 초대 · 함께 방문 요청이 여기에 모여요.</span>
        <MarkRead />
      </div>
    );
  }
  const today = items.filter((n) => isToday(n.createdAt));
  const earlier = items.filter((n) => !isToday(n.createdAt));
  return (
    <>
      <MarkRead />
      {[
        ["오늘", today],
        ["이전", earlier],
      ].map(([label, group]) =>
        (group as AppNotification[]).length === 0 ? null : (
          <section key={label as string} aria-label={label as string} className="flex flex-col pt-2">
            <h2 className="px-5 py-2 text-meta font-bold text-ink-2">{label as string}</h2>
            <ul className="flex flex-col">
              {(group as AppNotification[]).map((n) => (
                <Row key={n.id} n={n} />
              ))}
            </ul>
          </section>
        ),
      )}
    </>
  );
}

function Row({ n }: { n: AppNotification }) {
  return (
        <li>
          <Link href={notificationHref(n)} className={`flex min-h-16 items-center gap-3 px-5 py-3 ${n.read ? "" : "bg-surface"}`}>
            <Avatar name={n.actorNickname} size={40} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body leading-snug text-ink">{message(n)}</span>
              <span className="text-meta text-muted" suppressHydrationWarning>
                {timeLabel(n.createdAt)}
              </span>
            </span>
            {!n.read && (
              <span className="size-2 shrink-0 rounded-full bg-ink">
                <span className="sr-only">안 읽음</span>
              </span>
            )}
          </Link>
        </li>
  );
}
