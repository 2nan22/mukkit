import { AppHeader } from "@/components/AppHeader";
import { MeetupForm } from "@/features/meetup/MeetupForm";

export const metadata = { title: "새 약속" };

export default function NewMeetPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="close" fallback="/meet" title="새 약속" />
      <MeetupForm />
    </main>
  );
}
