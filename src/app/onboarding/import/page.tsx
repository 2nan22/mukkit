import { PageLoader } from "@/components/ui/EatingLoader";
import { getMyProfileFlags } from "@/features/profile/flags";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ONBOARDING_IMPORT, SESSION_ENDED, SIGNED_IN_HOME, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { ImportFlow } from "@/features/import/ImportFlow";
import { needsAgreement } from "@/features/legal/legal";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "저장해 둔 맛집 가져오기" };

// 처음 가입 직후 한 번 — 비어 있는 지도 대신 네이버 · 카카오에 저장해 둔 맛집부터 (건너뛰기 가능)
export default function OnboardingImportPage({ searchParams }: PageProps<"/onboarding/import">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <header className="flex h-14 shrink-0 items-center justify-end pr-2">
        <Link href={SIGNED_IN_HOME} replace className="flex h-11 items-center px-3 text-body text-muted">
          건너뛰기
        </Link>
      </header>
      <div className="flex flex-col gap-2 px-5 pb-4">
        <h1 className="text-title font-bold leading-snug tracking-tight">
          저장해 둔 맛집부터
          <br />
          가져와요
        </h1>
        <p className="text-body leading-normal text-ink-2">네이버 지도 · 카카오맵 리스트를 링크로 가져오면 첫 화면부터 내 지도가 채워져요.</p>
      </div>
      <Suspense fallback={<PageLoader />}>
        <Gate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 약관 동의 전이면 약관부터 · 이미 장소가 있으면 홈으로 (?preview=1 이면 장소가 있어도 이 화면 — 확인용)
async function Gate({ searchParams }: { searchParams: Promise<{ preview?: string | string[] }> }) {
  const { preview } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) redirect(SIGNED_OUT_HOME);
  const [profile, { count }] = await Promise.all([
    getMyProfileFlags(supabase),
    supabase.from("user_places").select("place_id", { count: "exact", head: true }).eq("user_id", me),
  ]);
  if (!profile) redirect(SESSION_ENDED);
  if (needsAgreement(profile)) redirect(`/onboarding/terms?next=${ONBOARDING_IMPORT}`);
  if ((count ?? 0) > 0 && preview !== "1") redirect(SIGNED_IN_HOME);
  return <ImportFlow helpOpen />;
}
