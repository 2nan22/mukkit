import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getMyMeetups } from "@/features/meetup/meetup";
import { MeetupCalendar } from "@/features/meetup/MeetupCalendar";
import { PushToggle } from "@/features/push/PushToggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약속" };

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
  const strip = (
    <div className="px-5 pt-6">
      <PushToggle variant="strip" text="초대가 오면 알림으로 알려 드려요" />
    </div>
  );
  if (meetups.length === 0) {
    return (
      <>
        <p className="px-8 py-10 text-center text-meta leading-normal text-muted">약속을 만들고 링크를 보내 보세요. 모두 가기 편한 곳을 추천해 드려요.</p>
        {strip}
      </>
    );
  }
  return (
    <>
      <MeetupCalendar meetups={meetups} />
      {strip}
    </>
  );
}
