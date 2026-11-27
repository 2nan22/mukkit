import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PageLoader } from "@/components/ui/EatingLoader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getCourse } from "@/features/meetup/course";
import { refreshCourseRoute } from "@/features/meetup/courseRoute";
import { after } from "next/server";
import { CourseEditor } from "@/features/meetup/CourseEditor";
import { getMeetupStatus, getMeetPoint } from "@/features/meetup/meetup";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "코스" };

// 약속 코스 (84) — 참여자만 · 끝난 약속은 약속 화면으로
export default function MeetCoursePage({ params }: PageProps<"/meet/[meetupId]/course">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Suspense fallback={<AppHeader kind="back" fallback="/meet" title="코스" />}>
        <CourseHeader params={params} />
      </Suspense>
      <Suspense fallback={<PageLoader />}>
        <MeetCourse params={params} />
      </Suspense>
    </main>
  );
}

// 링크로 바로 열었을 때 뒤로가기는 그 약속 화면으로
async function CourseHeader({ params }: { params: Promise<{ meetupId: string }> }) {
  const { meetupId } = await params;
  return <AppHeader kind="back" fallback={/^[0-9a-f-]{36}$/.test(meetupId) ? `/meet/${meetupId}` : "/meet"} title="코스" />;
}

async function MeetCourse({ params }: { params: Promise<{ meetupId: string }> }) {
  const { meetupId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(meetupId)) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  const [status, course, meet] = await Promise.all([getMeetupStatus(supabase, meetupId), getCourse(supabase, meetupId), getMeetPoint(supabase, meetupId)]);
  if (!status) redirect(`/meet/${meetupId}`);
  if (!status.isMember) notFound();
  if (status.status !== "open") redirect(`/meet/${meetupId}`);
  if (course.stale) after(() => refreshCourseRoute(meetupId).catch(() => false));
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return <CourseEditor meetupId={meetupId} course={course} meet={meet} meetupUrl={`${origin}/meet/${meetupId}`} />;
}
