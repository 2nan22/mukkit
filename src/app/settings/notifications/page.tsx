import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { PushKinds } from "@/features/push/PushKinds";
import { PushToggle } from "@/features/push/PushToggle";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "알림" };

// 설정 › 알림 — 이 기기 알림 켜기 + 종류별로 끄기 (42)
export default function NotificationSettingsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/settings" title="알림" />
      <section className="px-5">
        <PushToggle variant="row" />
      </section>
      <section className="flex flex-col px-5 pt-6">
        <h2 className="text-meta text-muted">받을 알림</h2>
        <p className="pb-1 text-caption text-subtle">이 기기 알림이 켜져 있을 때 받아요</p>
        <Suspense fallback={null}>
          <Kinds />
        </Suspense>
      </section>
    </main>
  );
}

async function Kinds() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const { data: row } = await supabase.from("profiles").select("push_off").eq("id", me).maybeSingle();
  return <PushKinds initialOff={(row?.push_off as string[] | null) ?? []} />;
}
