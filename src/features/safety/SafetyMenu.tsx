"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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

  function close() {
    setStep(null);
    setReason(null);
    setNote("");
    setError(null);
  }
  const finish = (res: { error?: string; done?: string }, refresh = false) => {
    if (res.error) return setError(res.error);
    setMessage(res.done ?? null);
    setStep("done");
    if (refresh) router.refresh();
  };

  return (
    <>
      <button type="button" aria-label={`${who} 더 보기`} onClick={() => setStep("menu")} className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {step && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={close}>
          <section role="dialog" aria-modal="true" aria-label="신고 · 차단" onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[480px] flex-col gap-1 rounded-t-[20px] bg-white px-5 pt-3 pb-6">
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
                    차단 해제
                  </button>
                ) : (
                  <button type="button" onClick={() => setStep("block")} className="flex h-12 items-center text-body text-danger">
                    {who} 차단하기
                  </button>
                )}
                <button type="button" onClick={close} className="mt-1 h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
                  닫기
                </button>
              </>
            )}

            {step === "report" && (
              <>
                <h2 className="pb-1 text-section font-bold">{placeId ? "이 평가를 신고하는 이유" : `${who}을 신고하는 이유`}</h2>
                <div role="radiogroup" aria-label="신고 이유" className="flex flex-col">
                  {REPORT_REASONS.map((r) => (
                    <label key={r} className="flex min-h-12 items-center gap-3 border-b border-line text-body">
                      <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-ink" />
                      {REASON_LABEL[r]}
                    </label>
                  ))}
                </div>
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
                <p className="pt-2 text-caption leading-normal text-muted">신고한 사실은 상대에게 알리지 않아요. 여러 명이 신고한 평가는 다른 사람에게 보이지 않게 돼요.</p>
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
                <p className="pt-1 text-meta leading-normal text-ink-2">서로의 평가 · 사진 · 리스트가 보이지 않고, 팔로우가 풀려요. 약속 초대와 함께 방문 요청도 주고받을 수 없어요.</p>
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
