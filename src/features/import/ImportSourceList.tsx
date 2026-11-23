"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SourceMark } from "@/components/brand/BrandLogo";
import { Toast } from "@/components/ui/Toast";
import { IMPORT_TIER_LABEL, IMPORT_TIERS, type ImportTier } from "./importMode";
import { syncLine, type ImportSourceRow } from "./importSources";
import { refreshImportSource } from "./refreshActions";
import { countDeletable, disconnectSource } from "./sourceActions";

function nameOf(r: ImportSourceRow): string {
  return r.name || "이름 없는 리스트";
}

// 원본 목록 — 줄을 누르면 먹킷 리스트로, ↻ 바로 새로 고치기, ⋯ 은 리스트 만들기 · 끊기 시트
export function ImportSourceList({ rows }: { rows: ImportSourceRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<{ row: ImportSourceRow; step: Step } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const opener = useRef<HTMLButtonElement | null>(null);
  const now = useNow();
  const close = () => {
    setOpen(null);
    opener.current?.focus();
  };
  // 기록이 있으면 바로, 없으면(예전에 등급을 매겨 가져온 것) 새 곳에 줄 등급부터 묻기
  const refresh = (r: ImportSourceRow, el: HTMLButtonElement) => {
    opener.current = el;
    if (!r.sync) return setOpen({ row: r, step: "setup" });
    const key = `${r.source}:${r.sourceListId}`;
    setBusy(key);
    start(async () => {
      const res = await refreshImportSource(r.source, r.sourceListId);
      setBusy(null);
      setToast(res.error ?? res.done ?? "");
      router.refresh();
    });
  };
  // 모두 새로 고치기 — 하나씩 차례로 (원본에 몰아서 부르지 않게). 등급을 정해야 하는 옛 원본은 빼고
  const [progress, setProgress] = useState<string | null>(null);
  const ready = rows.filter((r) => r.sync);
  const refreshAll = () =>
    start(async () => {
      let changed = 0;
      let failed = 0;
      let recent = 0;
      for (const [i, r] of ready.entries()) {
        setProgress(`${i + 1}/${ready.length}`);
        setBusy(`${r.source}:${r.sourceListId}`);
        const res = await refreshImportSource(r.source, r.sourceListId);
        if (res.error) failed += 1;
        else if (res.done?.startsWith("조금 전에")) recent += 1;
        else if (res.done && !res.done.startsWith("원본과 같아요")) changed += 1;
      }
      setBusy(null);
      setProgress(null);
      const parts = [`${ready.length - recent}개 확인`, changed ? `${changed}개 바뀜` : "바뀐 곳 없음", failed ? `${failed}개 실패` : "", recent ? `${recent}개는 조금 전에 확인함` : ""].filter(Boolean);
      setToast(parts.join(" · "));
      router.refresh();
    });
  return (
    <>
      {ready.length > 1 && (
        <div className="flex items-center justify-between px-5 pb-1">
          <span className="text-meta text-muted">원본 {rows.length}개</span>
          <button type="button" disabled={busy !== null} onClick={refreshAll} className="flex h-11 items-center gap-1.5 text-meta font-semibold text-ink disabled:opacity-60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={progress ? "animate-spin" : ""}>
              <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
            </svg>
            {progress ? `확인 중 ${progress}` : "모두 새로 고치기"}
          </button>
        </div>
      )}
      <ul className="flex flex-col px-5">
        {rows.map((r) => {
          const line = syncLine(r.sync, now);
          const body = (
            <>
              <span className="flex items-center gap-1.5">
                <SourceMark source={r.source} size={16} />
                <span className="truncate text-body font-semibold">{nameOf(r)}</span>
              </span>
              <span className={`text-meta ${line.warn ? "font-semibold text-ink" : "text-muted"}`}>
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
              <button
                type="button"
                disabled={busy !== null}
                aria-label={`${nameOf(r)} 지금 새로 고치기`}
                onClick={(e) => refresh(r, e.currentTarget)}
                className="flex h-11 shrink-0 items-center gap-1 rounded-full px-2 text-meta font-semibold text-ink disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={busy === `${r.source}:${r.sourceListId}` ? "animate-spin" : ""}>
                  <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
                </svg>
                {busy === `${r.source}:${r.sourceListId}` ? "확인 중" : "새로 고침"}
              </button>
              <button
                type="button"
                aria-label={`${nameOf(r)} 관리`}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setOpen({ row: r, step: "menu" });
                }}
                className="-mr-2 flex size-11 shrink-0 items-center justify-center text-muted"
              >
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
      <p className="px-5 pt-3 text-meta text-muted">새로 고침을 누르면 바로 원본을 확인해요. 새벽에도 자동으로 반영해요</p>
      {open && (
        <SourceSheet
          row={open.row}
          initialStep={open.step}
          onClose={close}
          onDone={(m) => {
            setOpen(null);
            setToast(m);
          }}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} bottom={96} />}
    </>
  );
}

// 그린 시각 기준 — 서버 · 브라우저 시각 차이로 글자가 어긋나지 않게 한 번만 잰다
function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

type Step = "menu" | "setup" | "choose" | "confirm";
// 장소까지 지우면 지워질 곳 수 — 세는 중(null) · 실패(error)
type Count = number | null | "error";

function SourceSheet({ row, initialStep, onClose, onDone }: { row: ImportSourceRow; initialStep: Step; onClose: () => void; onDone: (message: string) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [tier, setTier] = useState<ImportTier>(row.suggestedTier ?? "want_to_go");
  const [wipe, setWipe] = useState(false);
  const [count, setCount] = useState<Count>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const sheet = useRef<HTMLElement>(null);
  const name = nameOf(row);

  useEffect(() => {
    let live = true;
    countDeletable(row.source, row.sourceListId).then((n) => live && setCount(n ?? "error"));
    return () => {
      live = false;
    };
  }, [row.source, row.sourceListId]);
  // 단계가 바뀌어도 시트에 포커스 — 사라진 버튼에 남지 않게
  useEffect(() => sheet.current?.focus(), [step]);
  // Esc 는 어디에 포커스가 있든 닫기 · 뒤 화면 스크롤 막기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !pending && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [pending, onClose]);

  const deletable = typeof count === "number" ? count : 0;
  const canWipe = typeof count === "number" && count > 0;
  const refresh = () =>
    start(async () => {
      setError(null);
      const res = await refreshImportSource(row.source, row.sourceListId, row.sync ? undefined : tier);
      if (res.error) return setError(res.error);
      router.refresh();
      onDone(res.done ?? "");
    });
  const run = (deletePlaces: boolean) =>
    start(async () => {
      const res = await disconnectSource(row.source, row.sourceListId, deletePlaces);
      if (res.error) return setError(res.error);
      router.refresh();
      onDone(res.done ?? "");
    });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={pending ? undefined : onClose}>
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={step === "confirm" ? "장소 지우기 확인" : step === "choose" ? "연결 끊기" : step === "setup" ? "처음 새로 고치기" : `${name} 관리`}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[480px] flex-col gap-3 rounded-t-[20px] bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none"
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
        {step === "menu" ? (
          <>
            <div className="flex flex-col gap-1 pt-1">
              <h2 className="text-[18px] leading-snug font-bold">{name}</h2>
              <p className="text-meta text-muted">
                {row.count}곳 · {syncLine(row.sync).text}
              </p>
            </div>
            <div className="flex flex-col">
              <button type="button" disabled={pending} onClick={() => (row.sync ? refresh() : setStep("setup"))} className="flex h-12 items-center text-body text-ink disabled:opacity-50">
                {pending ? "원본을 확인하는 중…" : "지금 새로 고치기"}
              </button>
              {/* 등급을 매겨 가져와 먹킷 리스트가 없는 원본 — 원하면 리스트로 */}
              {!row.listId && (
                <Link href={`/lists/new?from=${row.source}:${encodeURIComponent(row.sourceListId)}`} className="flex h-12 items-center text-body text-ink">
                  리스트로 만들기
                </Link>
              )}
              <button type="button" disabled={pending} onClick={() => setStep("choose")} className="flex h-12 items-center text-body text-ink disabled:opacity-50">
                연결 끊기
              </button>
            </div>
            {error && (
              <p role="alert" className="text-meta text-danger">
                {error}
              </p>
            )}
            <button type="button" disabled={pending} onClick={onClose} className="mt-1 h-12 rounded-btn-m bg-surface text-body font-medium text-ink">
              닫기
            </button>
          </>
        ) : step === "setup" ? (
          <>
            <div className="flex flex-col gap-1 pt-1">
              <h2 className="text-[18px] leading-snug font-bold">새로 담긴 곳은 어떤 등급으로 저장할까요?</h2>
              <p className="text-meta text-muted">한 번만 정하면 다음부터 새벽에도 자동으로 새로 고쳐요</p>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">새 곳에 줄 등급</legend>
              {IMPORT_TIERS.map((t) => (
                <Option key={t} checked={tier === t} onPick={() => setTier(t)} title={IMPORT_TIER_LABEL[t]} desc={t === row.suggestedTier ? "이 원본에 가장 많이 준 등급" : ""} />
              ))}
            </fieldset>
            {error && (
              <p role="alert" className="text-meta text-danger">
                {error}
              </p>
            )}
            <button type="button" disabled={pending} onClick={refresh} className="mt-1 h-btn-l rounded-btn-m bg-ink text-body font-bold text-white disabled:opacity-40">
              {pending ? "원본을 확인하는 중…" : "새로 고치기"}
            </button>
            <button type="button" disabled={pending} onClick={onClose} className="h-11 text-body text-muted">
              취소
            </button>
          </>
        ) : step === "choose" ? (
          <>
            <div className="flex flex-col gap-1 pt-1">
              <h2 className="text-[18px] leading-snug font-bold">&lsquo;{name}&rsquo; 연결을 끊을까요?</h2>
              <p className="text-meta text-muted">{row.sync ? "끊으면 원본이 바뀌어도 먹킷에 반영되지 않아요" : "가져온 원본 목록에서 빠져요"}</p>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">끊는 방법</legend>
              <Option checked={!wipe} onPick={() => setWipe(false)} title="연결만 끊기" desc="저장한 곳 · 등급 · 메모는 그대로예요" />
              <Option
                checked={wipe}
                disabled={!canWipe}
                onPick={() => setWipe(true)}
                title="장소까지 지우기"
                desc={
                  count === null
                    ? "지울 곳을 세고 있어요"
                    : count === "error"
                      ? "지울 곳을 세지 못했어요. 잠시 뒤 다시 열어 주세요"
                      : count === 0
                        ? "지울 곳이 없어요. 모두 다른 리스트나 원본에도 있어요"
                        : `${count}곳의 등급 · 메모 · 사진을 지워요. 다른 리스트 · 원본에도 있는 곳은 남아요`
                }
              />
            </fieldset>
            {error && (
              <p role="alert" className="text-meta text-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={pending || (wipe && !canWipe)}
              onClick={() => (wipe ? setStep("confirm") : run(false))}
              className="mt-1 h-btn-l rounded-btn-m bg-ink text-body font-bold text-white disabled:opacity-40"
            >
              {wipe ? "다음" : pending ? "끊는 중…" : "연결 끊기"}
            </button>
            <button type="button" disabled={pending} onClick={() => (setError(null), setStep("menu"))} className="h-11 text-body text-muted">
              취소
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1 pt-1">
              <h2 className="text-[18px] leading-snug font-bold">
                &lsquo;{name}&rsquo;에서 온 {deletable}곳을 지울까요?
              </h2>
              <p className="text-meta leading-relaxed text-muted">
                등급 · 메모 · 사진, 받은 좋아요 · 댓글까지 지워져요. 되돌릴 수 없어요.
                {row.listId && " 이 원본으로 만든 리스트도 함께 지워져요."}
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
            <button type="button" disabled={pending} onClick={() => setStep("choose")} className="h-11 text-body text-muted">
              돌아가기
            </button>
          </>
        )}
      </section>
    </div>
  );
}

// 진짜 라디오 — 방향키로 옮기고 탭 정지는 하나
function Option({ checked, disabled = false, onPick, title, desc }: { checked: boolean; disabled?: boolean; onPick: () => void; title: string; desc: string }) {
  return (
    <label
      className={`flex items-start gap-3 rounded-[14px] border px-4 py-3.5 ${disabled ? "opacity-50" : "cursor-pointer"} ${checked ? "border-ink ring-1 ring-ink" : "border-line"} has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink`}
    >
      <input type="radio" name="disconnect" checked={checked} disabled={disabled} onChange={onPick} className="peer sr-only" />
      <span aria-hidden="true" className={`mt-0.5 size-5 shrink-0 rounded-full ${checked ? "border-[6px] border-ink" : "border-2 border-line-strong"}`} />
      <span className="flex flex-col gap-0.5">
        <span className="text-body font-bold">{title}</span>
        {desc && <span className="text-meta leading-relaxed text-muted">{desc}</span>}
      </span>
    </label>
  );
}
