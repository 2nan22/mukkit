import { AppHeader } from "@/components/AppHeader";
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
      <AppHeader kind="back" fallback="/my" title="프로필 수정" />
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
