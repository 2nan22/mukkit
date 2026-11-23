import { getMyProfileFlags } from "@/features/profile/flags";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { NotificationSettings } from "@/features/push/PushKinds";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "알림" };

// 설정 › 알림 — 이 기기 알림 켜기 + 종류별로 끄기 (42)
export default function NotificationSettingsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/settings" title="알림" />
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const flags = await getMyProfileFlags(supabase);
  return <NotificationSettings initialOff={flags?.push_off ?? []} />;
}
