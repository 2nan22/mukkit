import Link from "next/link";
import { Suspense } from "react";
import { LoginButtons } from "@/features/onboarding/LoginButtons";
import { LoginErrorNotice } from "@/features/onboarding/LoginErrorNotice";
import { MapIllustration } from "@/features/onboarding/MapIllustration";

export default function StartPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <MapIllustration />

      <section className="flex flex-1 flex-col gap-3 px-6 pt-6">
        <span className="text-body font-bold tracking-tight">마이슐랭</span>
        <h1 className="text-title font-bold leading-snug tracking-tight">
          믿을 만한 사람의 평가로
          <br />
          맛집을 고르세요
        </h1>
        <p className="text-body leading-relaxed text-ink-2">
          네이버 지도 · 카카오맵에 저장한 곳을 그대로 가져와
          <br />
          나만의 등급을 매기고 친구와 나눠요.
        </p>
      </section>

      <div className="flex flex-col gap-2.5 px-5 pb-5 pt-4">
        <Suspense fallback={null}>
          <LoginErrorNotice searchParams={searchParams} />
        </Suspense>
        <LoginButtons />
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
