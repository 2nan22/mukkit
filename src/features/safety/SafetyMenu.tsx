"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { honor } from "@/domain/honor";
import { block, report, unblock } from "./actions";
import { REASON_LABEL, REPORT_REASONS, type ReportReason } from "./reasons";

type Step = "menu" | "report" | "block" | "done";

// 평가 · 프로필의 '더 보기' — 신고하기 · 차단하기 (placeId 가 있으면 그 평가 신고)
export function SafetyMenu({ userId, nickname, placeId = null, blocked = false }: { userId: string; nickname: string; placeId?: string | null; blocked?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const who = honor(nickname);
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  // 차단 · 해제 뒤 화면 새로 고침은 결과를 본 뒤(확인 · 닫기)에 — 카드가 먼저 사라지지 않게
  const refreshOnClose = useRef(false);

  // 열리면 시트로 포커스, 닫히면 ⋯ 버튼으로
  useEffect(() => {
    if (step) sheet.current?.focus();
  }, [step]);

  function close() {
    setStep(null);
    setReason(null);
    setNote("");
    setError(null);
    if (refreshOnClose.current) {
      refreshOnClose.current = false;
      router.refresh();
    } else trigger.current?.focus();
  }
  const finish = (res: { error?: string; done?: string }, refresh = false) => {
    if (res.error) return setError(res.error);
    setMessage(res.done ?? null);
    setStep("done");
    if (refresh) refreshOnClose.current = true;
  };

  return (
    <>
      <button ref={trigger} type="button" aria-label={`${who} 더 보기`} onClick={() => setStep("menu")} className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {step && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={close}>
          <section
            ref={sheet}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={step === "report" ? "신고" : step === "block" ? "차단" : `${who} 신고 · 차단`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === "Escape" && close()}
            className="flex w-full max-w-[480px] flex-col gap-1 rounded-t-[20px] bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none"
          >
            <span aria-hidden="true" className="mx-auto mb-2 block h-1 w-9 rounded-full bg-line-strong" />
            {step === "menu" && (
              <>
                {placeId && (
                  <button type="button" onClick={() => setStep("report")} className="flex h-12 items-center text-body text-ink">
                    이 평가 신고하기
                  </button>
                )}
                {!placeId && (
                  <button type="button" onClick={() => setStep("report")} className="flex h-12 items-center text-body text-ink">
                    {who} 신고하기
                  </button>
                )}
                {blocked ? (
                  <button type="button" disabled={pending} onClick={() => start(async () => finish(await unblock(userId), true))} className="flex h-12 items-center text-body text-ink">
                    {who} 차단 해제
                  </button>
                ) : (
                  <button type="button" onClick={() => setStep("block")} className="flex h-12 items-center text-body text-danger">
                    {who} 차단하기
                  </button>
                )}
                {error && (
                  <p role="alert" className="text-meta text-danger">
                    {error}
                  </p>
                )}
                <button type="button" onClick={close} className="mt-1 h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
                  닫기
                </button>
              </>
            )}

            {step === "report" && (
              <>
                <h2 className="pb-1 text-section font-bold">{placeId ? "신고하는 이유를 골라 주세요" : `${who}을 신고하는 이유를 골라 주세요`}</h2>
                <fieldset className="flex flex-col">
                  <legend className="sr-only">신고 이유</legend>
                  {REPORT_REASONS.filter((r) => placeId || r !== "fake").map((r) => (
                    <label key={r} className="flex min-h-12 items-center gap-3 border-b border-line text-body">
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-ink" />
                      {REASON_LABEL[r]}
                    </label>
                  ))}
                </fieldset>
                {reason === "other" && (
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    rows={2}
                    aria-label="신고 내용"
                    placeholder="어떤 점이 문제인지 적어 주세요"
                    className="mt-2 w-full resize-none rounded-[12px] bg-surface px-3.5 py-3 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink"
                  />
                )}
                <p className="pt-2 text-caption leading-normal text-muted">{placeId ? "신고한 사실은 상대에게 알리지 않아요. 여러 명이 신고한 평가는 숨겨져요." : "신고한 사실은 상대에게 알리지 않아요."}</p>
                {error && (
                  <p role="alert" className="text-meta text-danger">
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-3">
                  <button type="button" onClick={close} className="h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={!reason || pending}
                    onClick={() => start(async () => finish(await report({ userId, placeId, reason: reason!, note })))}
                    className="h-12 rounded-btn-m bg-ink text-body font-bold text-white disabled:opacity-40"
                  >
                    신고하기
                  </button>
                </div>
              </>
            )}

            {step === "block" && (
              <>
                <h2 className="text-section font-bold">{who}을 차단할까요?</h2>
                <p className="pt-1 text-meta leading-normal text-ink-2">서로의 평가 · 사진 · 리스트가 보이지 않아요. 팔로우가 풀리고 약속 초대도 주고받을 수 없어요.</p>
                <p className="pt-1 text-caption text-muted">차단한 사실은 상대에게 알리지 않아요. 설정 › 계정에서 해제할 수 있어요.</p>
                {error && (
                  <p role="alert" className="text-meta text-danger">
                    {error}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 pt-4">
                  <button type="button" onClick={close} className="h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
                    취소
                  </button>
                  <button type="button" disabled={pending} onClick={() => start(async () => finish(await block(userId), true))} className="h-12 rounded-btn-m bg-danger text-body font-bold text-white disabled:opacity-40">
                    차단하기
                  </button>
                </div>
              </>
            )}

            {step === "done" && (
              <>
                <p role="status" className="py-3 text-body text-ink">
                  {message}
                </p>
                <button type="button" onClick={close} className="h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
                  확인
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
