import type { ReactNode } from "react";
import { BackButton } from "@/components/BackButton";

// 없는 페이지 · 오류 화면 공통 — 뒤로 버튼으로 온 곳에 돌아갈 수 있게 (바로 열었으면 홈)
export function StatusScreen({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-3 px-5 text-center">
      <BackButton fallback="/home" className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] left-2" />
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-surface text-muted">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
          <path d="M10 8l4 4M14 8l-4 4" />
        </svg>
      </span>
      <h1 className="text-section font-bold">{title}</h1>
      <p className="text-body leading-normal text-muted">{body}</p>
      <div className="flex w-full flex-col gap-2 pt-4">{children}</div>
    </main>
  );
}
