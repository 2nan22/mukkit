"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SourceMark } from "@/components/brand/BrandLogo";
import { Toast } from "@/components/ui/Toast";
import { syncLine, type ImportSourceRow } from "./importSources";
import { countDeletable, disconnectSource } from "./sourceActions";

// 원본 목록 — 줄을 누르면 먹킷 리스트로, ⋯ 은 끊기 시트
export function ImportSourceList({ rows }: { rows: ImportSourceRow[] }) {
  const [open, setOpen] = useState<ImportSourceRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const now = useNow();
  return (
    <>
      <ul className="flex flex-col px-5">
        {rows.map((r) => {
          const line = syncLine(r.sync, now);
          const body = (
            <>
              <span className="flex items-center gap-1.5">
                <SourceMark source={r.source} size={16} />
                <span className="truncate text-body font-semibold">{r.name || "이름 없는 리스트"}</span>
              </span>
              <span className={`text-meta ${line.warn ? "text-danger" : "text-muted"}`}>
                {r.count}곳 · {line.text}
              </span>
            </>
          );
          return (
            <li key={`${r.source}:${r.sourceListId}`} className="flex min-h-16 items-center gap-2 border-b border-line">
              {r.listId ? (
                <Link href={`/lists/${r.listId}`} className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">
                  {body}
                </Link>
              ) : (
                <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-3">{body}</span>
              )}
              <button type="button" aria-label={`${r.name} 더 보기`} onClick={() => setOpen(r)} className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="19" cy="12" r="1.6" />
                </svg>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-5 pt-3 text-meta text-muted">원본은 매일 새벽 새로 고쳐요</p>
      {open && <DisconnectSheet row={open} onClose={() => setOpen(null)} onDone={(m) => (setOpen(null), setToast(m))} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

// 그린 시각 기준 — 서버 · 브라우저 시각 차이로 글자가 어긋나지 않게 한 번만 잰다
function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

type Step = "choose" | "confirm";

function DisconnectSheet({ row, onClose, onDone }: { row: ImportSourceRow; onClose: () => void; onDone: (message: string) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [wipe, setWipe] = useState(false);
  const [deletable, setDeletable] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheet = useRef<HTMLElement>(null);

  useEffect(() => {
    sheet.current?.focus();
    let live = true;
    countDeletable(row.source, row.sourceListId).then((n) => live && setDeletable(n));
    return () => {
      live = false;
    };
  }, [row.source, row.sourceListId]);

  const kept = deletable === null ? 0 : row.count - deletable;
  const run = (deletePlaces: boolean) =>
    start(async () => {
      const res = await disconnectSource(row.source, row.sourceListId, deletePlaces);
      if (res.error) return setError(res.error);
      router.refresh();
      onDone(deletePlaces ? `${deletable}곳을 지웠어요` : "가져오기를 끊었어요");
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={pending ? undefined : onClose}>
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={step === "confirm" ? "장소 지우기 확인" : "가져오기 끊기"}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !pending && onClose()}
        className="flex w-full max-w-[480px] flex-col gap-3 rounded-t-[20px] bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none"
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
        {step === "choose" ? (
          <>
            <div className="flex flex-col gap-1 pt-1">
              <h2 className="text-[18px] leading-snug font-bold">&lsquo;{row.name}&rsquo; 가져오기를 끊을까요?</h2>
              <p className="text-meta text-muted">{row.sync ? "새벽마다 새로 고치지 않아요." : "원본 기록이 목록에서 빠져요."}</p>
            </div>
            <div role="radiogroup" aria-label="끊는 방법" className="flex flex-col gap-2">
              <Option checked={!wipe} onPick={() => setWipe(false)} title="연결만 끊기" desc={`저장한 ${row.count}곳 · 등급 · 메모는 그대로예요`} />
              <Option
                checked={wipe}
                disabled={deletable === 0}
                onPick={() => setWipe(true)}
                title="장소까지 지우기"
                desc={
                  deletable === null
                    ? "지울 곳을 세는 중이에요"
                    : deletable === 0
                      ? "지울 곳이 없어요. 모두 다른 리스트에도 담겨 있어요"
                      : `${deletable}곳을 등급 · 메모 · 사진까지 지워요${kept > 0 ? `. 다른 리스트에도 담긴 ${kept}곳은 남아요` : ""}`
                }
              />
            </div>
            {error && (
              <p role="alert" className="text-meta text-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={pending || (wipe && !deletable)}
              onClick={() => (wipe ? setStep("confirm") : run(false))}
              className="mt-1 h-btn-l rounded-btn-m bg-ink text-body font-bold text-white disabled:opacity-40"
            >
              {wipe ? "다음" : pending ? "끊는 중…" : "끊기"}
            </button>
            <button type="button" disabled={pending} onClick={onClose} className="h-10 text-body text-muted">
              취소
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1 pt-1">
              <h2 className="text-[18px] leading-snug font-bold">{deletable}곳을 지울까요?</h2>
              <p className="text-meta leading-relaxed text-muted">
                등급 · 메모 · 사진과 받은 좋아요 · 댓글도 지워지고 되돌릴 수 없어요.
                {row.listId && " 이 원본으로 만든 리스트도 지워져요."}
              </p>
            </div>
            {error && (
              <p role="alert" className="text-meta text-danger">
                {error}
              </p>
            )}
            <button type="button" disabled={pending} onClick={() => run(true)} className="mt-1 h-btn-l rounded-btn-m bg-danger text-body font-bold text-white disabled:opacity-40">
              {pending ? "지우는 중…" : `${deletable}곳 지우기`}
            </button>
            <button type="button" disabled={pending} onClick={() => setStep("choose")} className="h-10 text-body text-muted">
              돌아가기
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function Option({ checked, disabled = false, onPick, title, desc }: { checked: boolean; disabled?: boolean; onPick: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onPick}
      className={`flex items-start gap-3 rounded-[14px] border px-4 py-3.5 text-left disabled:opacity-50 ${checked ? "border-ink ring-1 ring-ink" : "border-line"}`}
    >
      <span aria-hidden="true" className={`mt-0.5 size-5 shrink-0 rounded-full ${checked ? "border-[6px] border-ink" : "border-2 border-line-strong"}`} />
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-bold">{title}</span>
        <span className="text-meta leading-relaxed text-muted">{desc}</span>
      </span>
    </button>
  );
}
