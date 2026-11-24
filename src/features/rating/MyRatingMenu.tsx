"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { clearRating } from "./actions";

// 장소 상세 '내 평가' ⋯ (67-2, Google 지도 내 리뷰 › 더보기) — 평가 수정 · 3숟가락 순위 다시 정하기 · 평가 삭제(무엇이 지워지는지 확인)
export function MyRatingMenu({ placeId, three }: { placeId: string; three: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"menu" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheet = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (step) sheet.current?.focus();
  }, [step]);
  const close = () => {
    setStep(null);
    setError(null);
    trigger.current?.focus();
  };
  const remove = () =>
    start(async () => {
      const res = await clearRating(placeId);
      if (res.error) return setError(res.error);
      setStep(null);
      router.refresh();
    });

  return (
    <>
      <button ref={trigger} type="button" aria-label="내 평가 더 보기" onClick={() => setStep("menu")} className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {step && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={close}>
          <section
            ref={sheet}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={step === "delete" ? "평가 삭제" : "내 평가 메뉴"}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="flex w-full max-w-[480px] flex-col gap-1 rounded-t-[20px] bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none"
          >
            <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-9 rounded-full bg-line-strong" />
            {step === "menu" ? (
              <>
                <Link href={`/rate/${placeId}?next=/p/${placeId}`} className="flex h-12 items-center text-body text-ink">
                  평가 수정
                </Link>
                {three && (
                  <Link href="/rank" className="flex h-12 items-center text-body text-ink">
                    3숟가락 순위 다시 정하기
                  </Link>
                )}
                <button type="button" onClick={() => setStep("delete")} className="flex h-12 items-center text-body text-danger">
                  평가 삭제
                </button>
                <button type="button" onClick={close} className="mt-1 h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
                  닫기
                </button>
              </>
            ) : (
              <>
                <h2 className="pb-1 text-section font-bold">평가를 삭제할까요?</h2>
                <p className="text-meta leading-normal text-ink-2">등급 · 한 줄 평가 · 먹은 메뉴 · 사진이 지워지고, 내 장소에는 평가 전으로 남아요. 메모와 리스트는 그대로예요.</p>
                {error && (
                  <p role="alert" className="text-meta text-danger">
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button type="button" onClick={close} className="h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
                    취소
                  </button>
                  <button type="button" disabled={pending} onClick={remove} className="h-12 rounded-btn-m bg-danger text-body font-bold text-white disabled:opacity-60">
                    {pending ? "삭제하는 중" : "삭제"}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
