import { getMyProfileFlags } from "@/features/profile/flags";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNextPath, SESSION_ENDED, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { AgreeForm } from "@/features/legal/AgreeForm";
import { needsAgreement } from "@/features/legal/legal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약관 동의" };

// 이미 가입한 사람이 약관 · 처리방침에 (다시) 동의하는 화면
export default function TermsAgreePage({ searchParams }: PageProps<"/onboarding/terms">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-10 pb-5">
      <div className="flex flex-col gap-2 pb-6">
        <h1 className="text-title font-bold leading-snug tracking-tight">
          이용약관과
          <br />
          개인정보 처리방침을 확인해 주세요
        </h1>
        <p className="text-body text-ink-2">내 기록을 어떻게 보관하고 보여주는지 정리했어요. 동의하면 그대로 계속 쓸 수 있어요.</p>
      </div>
      <Suspense fallback={null}>
        <Loader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Loader({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const profile = await getMyProfileFlags(supabase);
  if (!profile) redirect(SESSION_ENDED);
  if (!needsAgreement(profile)) redirect(nextPath);
  return <AgreeForm next={nextPath} />;
}
