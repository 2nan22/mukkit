import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { getBio, getPerson } from "@/features/social/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "프로필 수정" };

export default function EditProfilePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="grid h-14 shrink-0 grid-cols-[44px_1fr_44px] items-center px-2">
        <Link href="/my" aria-label="MY 로" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-center text-section font-bold">프로필 수정</h1>
        <span />
      </header>
      <Suspense fallback={null}>
        <EditLoader />
      </Suspense>
    </main>
  );
}

async function EditLoader() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const [person, bio] = await Promise.all([getPerson(supabase, me), getBio(supabase, me)]);
  return <ProfileForm nickname={person?.nickname ?? ""} bio={bio} />;
}
