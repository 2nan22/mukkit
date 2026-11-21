import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { PURPOSE_LABEL } from "@/domain/meetup";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMyMeetups } from "@/features/meetup/meetup";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속" };

function when(iso: string | null): string {
  if (!iso) return "시간 미정";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export default function MeetListPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/home" title="약속" />
      <div className="px-5 pb-4">
        <Link href="/meet/new" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
          새 약속 잡기
        </Link>
      </div>
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <MeetList />
      </Suspense>
    </main>
  );
}

async function MeetList() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const meetups = await getMyMeetups(supabase, me);
  if (meetups.length === 0) {
    return <p className="px-8 py-10 text-center text-meta leading-normal text-muted">약속을 만들고 링크를 보내 보세요. 두 사람 모두 가기 편한 곳을 추천해 드려요.</p>;
  }
  return (
    <ul className="flex flex-col px-5">
      {meetups.map((m) => (
        <li key={m.id}>
          <Link href={`/meet/${m.id}`} className="flex min-h-16 items-center gap-3 border-b border-line py-2.5">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body font-semibold">
                {m.invited
                  ? `${m.hostNickname}님의 ${PURPOSE_LABEL[m.purpose]} 초대`
                  : `${PURPOSE_LABEL[m.purpose]} · ${m.others.length === 0 ? "함께할 분을 기다리는 중" : m.others.length === 1 ? `${m.others[0]}님과` : `${m.others[0]}님 외 ${m.others.length - 1}명`}`}
              </span>
              <span className="text-meta text-muted">
                {when(m.startsAt)}
                {m.status !== "open" && ` · ${m.status === "done" ? "끝남" : "취소"}`}
                {m.invited && " · 수락 기다리는 중"}
              </span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-subtle" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
