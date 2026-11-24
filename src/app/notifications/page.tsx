import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { honor } from "@/domain/honor";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getNotifications, groupNotifications, notificationHref, type GroupedNotification } from "@/features/notifications/notifications";
import { MarkRead } from "@/features/notifications/MarkRead";
import { FollowButton } from "@/features/social/FollowButton";
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

// 아래 회색 줄 — 장소 이름 또는 추천 지역 소식
function sub(n: GroupedNotification): string {
  if (n.kind === "meetup_ready") return n.firstReady ? "추천 지역이 나왔어요" : "추천 지역이 바뀌었어요";
  return n.placeName ?? "";
}

// 한 줄 문구 — 장소 이름은 문장에 넣지 않고 아래 회색 줄로 (66 디자인 검토: 길면 어색)
function message(n: GroupedNotification): string {
  const who = n.otherActors > 0 ? `${honor(n.actorNickname)} 외 ${n.otherActors}명` : honor(n.actorNickname);
  switch (n.kind) {
    case "comment":
      return n.ownerId === n.actorId
        ? `${who}이 댓글을 남겼어요`
        : n.count > 1
          ? `${who}이 내 평가에 댓글 ${n.count}개를 남겼어요`
          : `${who}이 내 평가에 댓글을 남겼어요`;
    case "like":
      return `${who}이 내 평가를 좋아해요`;
    case "follow":
      return `${who}이 팔로우했어요`;
    case "meetup_invite":
      return `${who}이 약속에 초대했어요`;
    case "meetup_join":
      return `${who}이 약속에 참여했어요`;
    case "meetup_ready":
      return `${who}이 ${n.pointKind === "return" ? "귀가지" : "출발지"}를 넣었어요`;
    case "visit_tag":
      return `${who}이 함께 갔다고 남겼어요`;
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
        <span className="text-meta text-muted">댓글 · 좋아요 · 팔로우 · 약속 · 함께 방문 소식이 여기에 모여요</span>
        <MarkRead />
      </div>
    );
  }
  // 나를 팔로우한 사람 중 내가 아직 팔로우하지 않은 사람 — 알림 줄에서 바로 맞팔로우
  const followers = [...new Set(items.filter((n) => n.kind === "follow").map((n) => n.actorId))];
  const { data: back } = followers.length
    ? await supabase.from("follows").select("followee_id").eq("follower_id", me).in("followee_id", followers)
    : { data: [] };
  const followingBack = new Set((back ?? []).map((r) => r.followee_id as string));
  const today = groupNotifications(items.filter((n) => isToday(n.createdAt)));
  const earlier = groupNotifications(items.filter((n) => !isToday(n.createdAt)));
  return (
    <>
      <MarkRead />
      {[
        ["오늘", today],
        ["이전", earlier],
      ].map(([label, group]) =>
        (group as GroupedNotification[]).length === 0 ? null : (
          <section key={label as string} aria-label={label as string} className="flex flex-col pt-2">
            <h2 className="px-5 py-2 text-meta font-bold text-ink-2">{label as string}</h2>
            <ul className="flex flex-col">
              {(group as GroupedNotification[]).map((n) => (
                <Row key={n.id} n={n} followBack={n.kind === "follow" && !followingBack.has(n.actorId)} />
              ))}
            </ul>
          </section>
        ),
      )}
    </>
  );
}

function Row({ n, followBack }: { n: GroupedNotification; followBack: boolean }) {
  return (
        <li className={`flex items-center pr-5 ${n.read ? "" : "bg-surface"}`}>
          <Link href={notificationHref(n)} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-5">
            <Avatar name={n.actorNickname} size={40} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body leading-snug text-pretty text-ink">{message(n)}</span>
              <span className="truncate text-meta text-muted" suppressHydrationWarning>
                {sub(n) ? `${sub(n)} · ` : ""}
                {timeLabel(n.createdAt)}
              </span>
            </span>
          </Link>
          {followBack && <FollowButton targetId={n.actorId} following={false} compact />}
          {/* 안 읽음 점은 모든 줄에서 오른쪽 끝 — 맞팔로우 버튼이 있어도 같은 자리 */}
          {!n.read && (
            <span className={`size-2 shrink-0 rounded-full bg-ink ${followBack ? "ml-3" : ""}`}>
              <span className="sr-only">안 읽음</span>
            </span>
          )}
        </li>
  );
}
