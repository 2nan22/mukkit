import Link from "next/link";
import { Suspense } from "react";
import { LoginButtons } from "@/features/onboarding/LoginButtons";
import { LoginErrorNotice } from "@/features/onboarding/LoginErrorNotice";
import { IntroSlides } from "@/features/onboarding/IntroSlides";
import { safeNextPath } from "@/features/auth/paths";

export default function StartPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <IntroSlides />

      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-4">
        <Suspense fallback={null}>
          <LoginErrorNotice searchParams={searchParams} />
        </Suspense>
        <Suspense fallback={<LoginButtons />}>
          <StartLoginButtons searchParams={searchParams} />
        </Suspense>
        <p className="pt-2 text-center text-caption leading-normal text-muted">
          시작하기 전에{" "}
          <Link href="/terms" className="underline underline-offset-2">
            이용약관
          </Link>
          과{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보 처리방침
          </Link>
          을 확인해 주세요.
        </p>
      </div>
    </main>
  );
}

// 공유 리스트 · 프로필 · 보호 화면에서 왔으면 로그인 뒤 그 화면으로 (next)
async function StartLoginButtons({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginButtons next={typeof next === "string" ? safeNextPath(next) : undefined} />;
}
