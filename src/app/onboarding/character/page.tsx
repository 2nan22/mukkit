import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { isCharacterId } from "@/components/growth/Character";
import { NICKNAME_SETUP, ONBOARDING_CHARACTER, safeNextPath, SESSION_ENDED, SIGNED_OUT_HOME } from "@/features/auth/paths";
import { CharacterPicker } from "@/features/growth/CharacterPicker";
import { getMyGrowth } from "@/features/growth/growth";
import { needsAgreement } from "@/features/legal/legal";
import { getMyProfileFlags } from "@/features/profile/flags";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "캐릭터 고르기" };

// 처음 가입할 때 한 번 — 평가할수록 자라는 캐릭터 고르기 (건너뛰면 내 정보 탭에서 고른다)
export default function OnboardingCharacterPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <Suspense fallback={null}>
        <Gate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Gate({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  // 이 화면은 보호 경로 확인(proxy) 밖이라 닉네임 · 약관을 여기서 본다
  const here = `${ONBOARDING_CHARACTER}?next=${encodeURIComponent(nextPath)}`;
  const [flags, growth] = await Promise.all([getMyProfileFlags(supabase), getMyGrowth(supabase)]);
  if (!flags) redirect(SESSION_ENDED);
  if (!flags.nickname_set_at) redirect(`${NICKNAME_SETUP}?next=${encodeURIComponent(here)}`);
  if (needsAgreement(flags)) redirect(`/onboarding/terms?next=${encodeURIComponent(here)}`);
  if (isCharacterId(growth.character)) redirect(nextPath);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-end pr-2">
        <Link href={nextPath} replace className="flex h-11 items-center px-3 text-body text-muted">
          건너뛰기
        </Link>
      </header>
      <div className="flex flex-col gap-2 px-5 pb-6">
        <h1 className="text-title font-bold leading-snug tracking-tight">
          키울 캐릭터를
          <br />
          골라 주세요
        </h1>
        <p className="text-body leading-normal text-ink-2">평가할수록 자라요. 나중에 내 정보에서 바꿀 수 있어요.</p>
      </div>
      <div className="px-5">
        <CharacterPicker done={nextPath} />
      </div>
    </>
  );
}
