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
        <a
          href="/auth/login/kakao"
          className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l bg-[#fee500] text-[16px] font-bold text-[#191919]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 5.9L6.5 20l3.6-2.2c.6.1 1.3.2 1.9.2 5 0 9-3.1 9-7s-4-7-9-7z"
              fill="#191919"
            />
          </svg>
          카카오로 시작하기
        </a>
        <button
          type="button"
          disabled
          className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l border border-line-strong text-[16px] font-bold text-muted"
        >
          구글로 시작하기 · 준비 중
        </button>
        <button
          type="button"
          disabled
          className="flex h-btn-l items-center justify-center gap-2 rounded-btn-l border border-line-strong text-[16px] font-bold text-muted"
        >
          네이버로 시작하기 · 준비 중
        </button>
        <p className="pt-2 text-center text-caption leading-normal text-muted">
          시작하면 이용약관과 개인정보 처리방침에 동의하게 돼요.
        </p>
      </div>
    </main>
  );
}
