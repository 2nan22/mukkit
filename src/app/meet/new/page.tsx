import { connection } from "next/server";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { MeetupForm } from "@/features/meetup/MeetupForm";

export const metadata = { title: "새 약속" };

export default function NewMeetPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="close" fallback="/meet" title="새 약속" />
      <Suspense fallback={null}>
        <Form />
      </Suspense>
    </main>
  );
}

// 오늘 날짜 · 지난 시각을 쓰므로 요청 시점에 그린다
async function Form() {
  await connection();
  return <MeetupForm />;
}
