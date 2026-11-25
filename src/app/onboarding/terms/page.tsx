import { PageLoader } from "@/components/ui/EatingLoader";
import { getMyProfileFlags } from "@/features/profile/flags";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { safeNextPath, SESSION_ENDED, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { AgreeForm } from "@/features/legal/AgreeForm";
import { EFFECTIVE_DATE, needsAgreement } from "@/features/legal/legal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "약관 동의" };

// 이미 가입한 사람이 약관 · 처리방침에 (다시) 동의하는 화면
export default function TermsAgreePage({ searchParams }: PageProps<"/onboarding/terms">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pt-10 pb-5">
      <Suspense fallback={<PageLoader />}>
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
  // 예전 버전에 동의한 사람은 개정 안내로 (70-5)
  const revised = profile.terms_version !== null;
  return (
    <>
      <div className="flex flex-col gap-2 pb-6">
        <h1 className="text-title font-bold leading-snug tracking-tight">
          {revised ? (
            "서비스 이용약관 개정 안내"
          ) : (
"약관 동의"
          )}
        </h1>
        {/* 개정 안내 첫 문장은 위버스 · 토스 공지 형식 (70-6) */}
        <p className="text-body text-ink-2 break-keep">
          {revised ? (
            <>
              안녕하세요, 먹킷입니다.
              <br />
              서비스 개선에 따라 이용약관을
              <br />
              개정하게 되어 안내드립니다.
            </>
          ) : (
            "서비스 이용을 위해 아래 약관에 동의해 주세요."
          )}
        </p>
      </div>
      <AgreeForm next={nextPath} revised={revised} effectiveDate={EFFECTIVE_DATE} />
    </>
  );
}
