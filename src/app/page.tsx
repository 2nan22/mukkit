import { GoogleG, KakaoSymbol, NaverN } from "@/components/brand/BrandLogo";
import { Suspense } from "react";
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
          네이버 지도에 저장한 곳을 그대로 가져와
          <br />
          나만의 등급을 매기고 친구와 나눠요.
        </p>
      </section>

      <div className="flex flex-col gap-2 px-5 pb-5 pt-4">
        <Suspense fallback={null}>
          <LoginErrorNotice searchParams={searchParams} />
        </Suspense>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 로그인 라우트는 전체 이동이어야 함 (Link 프리페치가 OAuth 시작을 부르지 않게) */}
        <a
          href="/auth/login/kakao"
          className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l bg-[#FEE500] text-[16px] font-bold text-black/85"
        >
          <KakaoSymbol />
          카카오로 시작하기
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 로그인 라우트는 전체 이동이어야 함 (Link 프리페치가 OAuth 시작을 부르지 않게) */}
        <a
          href="/auth/login/google"
          className="flex h-btn-l items-center justify-center gap-2.5 rounded-btn-l border border-[#747775] bg-white text-[16px] font-bold text-[#1F1F1F]"
        >
          <GoogleG />
          Google로 계속하기
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- 로그인 라우트는 전체 이동이어야 함 (Link 프리페치가 OAuth 시작을 부르지 않게) */}
        <a
          href="/auth/login/naver"
          className="flex h-btn-l items-center justify-center gap-2.5 rounded-btn-l bg-[#03C75A] text-[16px] font-bold text-white"
        >
          <NaverN />
          네이버로 시작하기
        </a>
        <p className="pt-2 text-center text-caption leading-normal text-muted">
          시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요.
        </p>
      </div>
    </main>
  );
}
