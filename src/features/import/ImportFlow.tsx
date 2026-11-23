"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { importList, previewList, type ListPreview } from "./actions";
import { extractLink, SOURCE_LABEL } from "./sources";
import { SourceMark } from "@/components/brand/BrandLogo";
import type { PlaceSourceName } from "@/domain/importedPlace";
import {
  guessMode,
  IMPORT_TIER_LABEL,
  IMPORT_TIERS,
  modeFromValue,
  modeLabel,
  modeToValue,
  PLAIN_LABEL,
  type ImportMode,
} from "./importMode";
import type { ImportResult } from "./saveImportedList";
import { TierBadge } from "@/components/ui/TierBadge";
import { tierFromDb } from "@/domain/tier";

type Row = ListPreview & { link: string; mode: ImportMode };
type RowStatus = { state: "waiting" | "running" } | { state: "done"; result: ImportResult } | { state: "failed"; error: string };
type Phase = "select" | "running" | "done";

const ERROR_TEXT = "text-danger";

// initialLink: 앱 공유 시트에서 넘어온 링크 — 바로 확인한다 · helpOpen: 링크 찾는 법을 펼친 채로 (처음 가입)
export function ImportFlow({ initialLink = "", helpOpen = false }: { initialLink?: string; helpOpen?: boolean } = {}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<Phase>("select");
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  async function runImport() {
    setPhase("running");
    setStatus(Object.fromEntries(rows.map((r) => [r.listId, { state: "waiting" }])));
    for (const row of rows) {
      setStatus((s) => ({ ...s, [row.listId]: { state: "running" } }));
      const res = await importList(row.link, row.mode);
      setStatus((s) => ({
        ...s,
        [row.listId]: res.ok ? { state: "done", result: res.data } : { state: "failed", error: res.error },
      }));
    }
    setPhase("done");
  }

  if (phase === "done") {
    const restart = () => {
      setRows([]);
      setStatus({});
      setPhase("select");
    };
    return <ImportDone rows={rows} status={status} onRestart={restart} />;
  }
  if (phase === "running") return <ImportRunning rows={rows} status={status} total={total} />;

  return (
    <div className="flex flex-1 flex-col">
      <LinkForm
        initialLink={initialLink}
        helpOpen={helpOpen}
        onAdd={(row) => setRows((rs) => (rs.some((r) => r.listId === row.listId) ? rs : [...rs, row]))}
      />
      <section className="flex flex-1 flex-col px-5 pt-4">
        {rows.length === 0 ? (
          <p className="text-meta leading-normal text-muted">
            네이버 지도 리스트나 카카오맵 즐겨찾기 폴더의 공유 링크를 넣어 주세요. 여러 개면 하나씩 불러오면 돼요.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="text-section font-bold">리스트 {rows.length}개</h2>
              <span className="text-meta text-muted">{total}곳</span>
            </div>
            <p className="mt-1 mb-1 text-meta leading-normal text-muted">
              등급별로 나눠 둔 리스트라면 그 등급을 골라 주세요. 그냥 모아 둔 리스트는 그대로 가져온 뒤 하나씩 평가하면 돼요.
            </p>
            <ul>
              {rows.map((row) => (
                <ListRow
                  key={row.listId}
                  row={row}
                  onChange={(mode) => setRows((rs) => rs.map((r) => (r.listId === row.listId ? { ...r, mode } : r)))}
                  onRemove={() => setRows((rs) => rs.filter((r) => r.listId !== row.listId))}
                />
              ))}
            </ul>
          </>
        )}
      </section>
      <div className="px-5 pt-3 pb-5">
        <button
          type="button"
          disabled={rows.length === 0}
          onClick={runImport}
          className="h-btn-l w-full rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-40 raised-brand"
        >
          {rows.length === 0 ? "가져오기" : `${total}곳 가져오기`}
        </button>
      </div>
    </div>
  );
}

function LinkForm({ onAdd, initialLink, helpOpen }: { onAdd: (row: Row) => void; initialLink: string; helpOpen: boolean }) {
  const [link, setLink] = useState(initialLink);
  const form = useRef<HTMLFormElement>(null);
  // 공유 시트로 들어온 링크는 바로 확인
  useEffect(() => {
    if (initialLink) form.current?.requestSubmit();
  }, [initialLink]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ text: string; privateList: boolean; source: PlaceSourceName | null } | null>(null);
  const [showHelp, setShowHelp] = useState(helpOpen);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!link.trim()) return;
    setPending(true);
    const res = await previewList(link.trim());
    setPending(false);
    if (!res.ok) {
      setError({ text: res.error, privateList: res.code === "LIST_NOT_FOUND_OR_PRIVATE", source: res.source ?? null });
      return;
    }
    setError(null);
    setLink("");
    // 리스트가 담기면 안내를 접어 담긴 리스트가 바로 보이게
    setShowHelp(false);
    onAdd({ ...res.data, link: extractLink(link), mode: guessMode(res.data.name) });
  }

  return (
    <div className="flex flex-col border-b-8 border-surface">
      <form ref={form} onSubmit={submit} className="flex flex-col gap-2 px-5 pt-3 pb-4">
        <label htmlFor="link" className="text-meta font-bold">
          공유 링크
        </label>
        <div className="flex gap-2">
          <input
            id="link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="naver.me/… 또는 kko.to/…"
            inputMode="url"
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "link-err" : undefined}
            className={`h-12 min-w-0 flex-1 rounded-btn-m px-3.5 text-body text-ink outline-none focus:border-ink ${
              error ? "border-[1.5px] border-[#d92d20]" : "border border-line-strong"
            }`}
          />
          <button
            type="submit"
            disabled={pending}
            className="h-12 shrink-0 rounded-btn-m bg-brand px-4 text-body font-bold text-white disabled:opacity-60 raised-brand"
          >
            {pending ? "확인하는 중" : error ? "다시 시도" : "링크 확인"}
          </button>
        </div>
        {error && (
          <p id="link-err" role="alert" className={`text-meta leading-normal ${ERROR_TEXT}`}>
            {error.text}
          </p>
        )}
        {!error?.privateList && (
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            className="h-btn-m self-start text-meta text-muted underline underline-offset-[3px]"
          >
            공유 링크 찾는 법
          </button>
        )}
      </form>
      {(error?.privateList || showHelp) && (
        <LinkHelp source={error?.privateList ? error.source : null} privateList={Boolean(error?.privateList)} />
      )}
    </div>
  );
}

// 앱 화면 순서는 2026-11 네이버 지도 · 카카오맵 앱 기준 (사용자 캡처로 확인)
const HELP: Record<PlaceSourceName, { app: string; url: string; find: ReactNode[]; pc: ReactNode; open: ReactNode[]; art: string[] }> = {
  naver: {
    app: "네이버 지도",
    url: "https://map.naver.com/",
    find: [
      <>네이버 지도 앱 <b>저장</b>에서 가져올 리스트의 <b>⋮</b>를 눌러요</>,
      <><b>공유</b>를 누르고 <b>복사</b>를 골라요. 리스트 이름이 같이 복사돼도 괜찮아요</>,
      <>위 칸에 붙여 넣어요. 비공개 리스트는 <b>일부 공개</b> 이상으로 바꿔야 해요</>,
    ],
    pc: <>PC에서는 리스트의 <b>⋮ › 공유</b>에서 링크 <b>복사</b></>,
    open: [
      <>네이버 지도 <b>저장</b>에서 가져올 리스트의 <b>⋮</b>를 눌러요</>,
      <><b>수정 › 공개 범위</b>를 <b>일부 공개</b>나 <b>전체 공개</b>로 바꿔요</>,
      <>다시 <b>⋮ › 공유</b>로 받은 링크를 위 칸에 넣어요</>,
    ],
    art: ["⋮", "공유", "복사"],
  },
  kakao: {
    app: "카카오맵",
    url: "https://map.kakao.com/",
    find: [
      <>카카오맵 앱 <b>즐겨찾기</b>에서 가져올 그룹을 열어요</>,
      <>위쪽 <b>공유</b> 버튼을 누르고 <b>URL 복사</b>를 골라요</>,
      <>위 칸에 붙여 넣어요. 비공개 그룹은 <b>공개</b>로 바꿔야 해요</>,
    ],
    pc: <>PC에서는 그룹의 <b>⋮ › 그룹 공유</b>에서 <b>복사</b></>,
    open: [
      <>카카오맵 <b>즐겨찾기</b>에서 가져올 그룹의 <b>⋮</b>를 눌러요</>,
      <><b>그룹 수정</b>에서 <b>공개</b>로 바꿔요</>,
      <>다시 <b>공유 › URL 복사</b>로 받은 링크를 위 칸에 넣어요</>,
    ],
    art: ["그룹", "공유", "URL 복사"],
  },
};

// 순서 그림 — 누를 곳만 굵게 (각 앱 화면을 그대로 옮기지 않는다)
function HelpArt({ steps }: { steps: string[] }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-1.5">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-1.5">
          <div className="flex h-16 flex-1 flex-col justify-center gap-1.5 rounded-[12px] bg-surface px-2.5">
            <span className="h-1.5 w-3/4 rounded-full bg-line-strong" />
            <span className="flex h-6 items-center justify-center self-start rounded-full bg-ink px-2.5 text-caption font-bold text-white">{label}</span>
          </div>
          {i < steps.length - 1 && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-subtle">
              <path d="M9 6l6 6-6 6" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

function LinkHelp({ source, privateList }: { source: PlaceSourceName | null; privateList: boolean }) {
  const shown: PlaceSourceName[] = source ? [source] : ["naver", "kakao"];
  return (
    <div className="flex flex-col gap-6 px-5 pt-1 pb-5">
      {!privateList && (
        <p className="rounded-[12px] bg-surface px-3.5 py-3 text-meta leading-normal text-ink-2">
          홈 화면에 먹킷을 추가했다면, 네이버 지도 · 카카오맵 앱의 <b>공유</b>에서 <b>먹킷</b>을 바로 골라도 돼요. (안드로이드)
        </p>
      )}
      {shown.map((name) => {
        const help = HELP[name];
        const steps = privateList ? help.open : help.find;
        return (
          <section key={name} className="flex flex-col gap-3.5">
            <h2 className="flex items-center gap-2 text-section font-bold">
              <SourceMark source={name} size={20} />
              {privateList ? `${help.app}에서 공개 범위 바꾸기` : `${help.app} 공유 링크 찾는 법`}
            </h2>
            {!privateList && <HelpArt steps={help.art} />}
            <ol className="flex flex-col gap-3.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-meta font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="pt-px text-body leading-normal">{step}</span>
                </li>
              ))}
            </ol>
            {!privateList && <p className="text-meta text-muted">{help.pc}</p>}
            <a
              href={help.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-btn-m items-center justify-center rounded-btn-m border border-line-strong text-body font-bold text-ink"
            >
              {help.app} 열기
            </a>
          </section>
        );
      })}
    </div>
  );
}

function ListRow({ row, onChange, onRemove }: { row: Row; onChange: (mode: ImportMode) => void; onRemove: () => void }) {
  const selectId = `mode-${row.listId}`;
  return (
    <li className="flex min-h-[60px] items-center gap-2 border-b border-line">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body">{row.name}</span>
        <span className="text-meta text-muted">
          <span className="inline-flex items-center gap-1.5">
            <SourceMark source={row.source} size={14} />
            {SOURCE_LABEL[row.source]} · {row.count}곳{row.unavailable > 0 && ` · 정보 없는 곳 ${row.unavailable}`}
          </span>
        </span>
      </span>
      <label htmlFor={selectId} className="sr-only">
        {row.name} 가져올 방식
      </label>
      <span className="relative flex h-btn-m shrink-0 items-center gap-1.5 rounded-btn-m border border-line-strong pr-2.5 pl-3">
        <ModeChip mode={row.mode} />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
        <select
          id={selectId}
          value={modeToValue(row.mode)}
          onChange={(e) => onChange(modeFromValue(e.target.value))}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <optgroup label="리스트 그대로">
            <option value="plain">{PLAIN_LABEL}</option>
          </optgroup>
          <optgroup label="등급으로 가져오기">
            {IMPORT_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {IMPORT_TIER_LABEL[tier]}
              </option>
            ))}
          </optgroup>
        </select>
      </span>
      <button type="button" onClick={onRemove} aria-label={`${row.name} 빼기`} className="flex size-11 shrink-0 items-center justify-center text-muted">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}

function ModeChip({ mode }: { mode: ImportMode }) {
  if (mode.kind === "tier") return <TierBadge tier={tierFromDb(mode.tier)} />;
  return (
    <span className="flex h-5 items-center rounded border border-line-strong px-1.5 text-caption font-bold whitespace-nowrap text-ink-2">
      {modeLabel(mode)}
    </span>
  );
}

function ImportRunning({ rows, status, total }: { rows: Row[]; status: Record<string, RowStatus>; total: number }) {
  const doneCount = rows.reduce((sum, r) => {
    const s = status[r.listId];
    return s?.state === "done" || s?.state === "failed" ? sum + r.count : sum;
  }, 0);
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-col gap-2 px-5 pt-8 pb-6">
        <h2 className="text-title font-bold tracking-tight">가져오는 중이에요</h2>
        <p className="text-body text-ink-2">
          {total}곳 중 <b>{doneCount}곳</b>
        </p>
        <div
          role="progressbar"
          aria-label="가져오기 진행률"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={doneCount}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} />
        </div>
      </section>
      <ul className="flex-1 px-5">
        {rows.map((row) => {
          const s = status[row.listId]?.state ?? "waiting";
          return (
            <li key={row.listId} className={`flex min-h-14 items-center gap-3 border-b border-line ${s === "waiting" ? "text-muted" : ""}`}>
              <StatusIcon state={s} />
              <span className={`min-w-0 flex-1 truncate text-body ${s === "running" ? "font-bold" : ""}`}>{row.name}</span>
              <ModeChip mode={row.mode} />
              <span className="w-12 text-right text-meta text-muted">{row.count}곳</span>
            </li>
          );
        })}
      </ul>
      <p className="px-5 pt-3 pb-5 text-center text-meta leading-normal text-muted">화면을 닫지 말고 잠시만 기다려 주세요</p>
    </div>
  );
}

function StatusIcon({ state }: { state: RowStatus["state"] }) {
  if (state === "running")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="img" aria-label="가져오는 중" className="animate-spin motion-reduce:animate-none">
        <circle cx="12" cy="12" r="9" stroke="var(--color-line)" strokeWidth="2.5" />
        <path d="M12 3a9 9 0 0 1 9 9" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  if (state === "done")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="img" aria-label="완료">
        <circle cx="12" cy="12" r="10" fill="var(--color-ink)" />
        <path d="M7.5 12.5l3 3 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (state === "failed")
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="img" aria-label="실패">
        <circle cx="12" cy="12" r="10" fill="#c4320a" />
        <path d="M12 7v6M12 16.5v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="img" aria-label="대기">
      <circle cx="12" cy="12" r="9" stroke="var(--color-line-strong)" strokeWidth="2" />
    </svg>
  );
}

function ImportDone({ rows, status, onRestart }: { rows: Row[]; status: Record<string, RowStatus>; onRestart: () => void }) {
  const finished = rows.flatMap((row) => {
    const s = status[row.listId];
    return s?.state === "done" ? [{ row, result: s.result }] : [];
  });
  const failed = rows.flatMap((row) => {
    const s = status[row.listId];
    return s?.state === "failed" ? [{ row, error: s.error }] : [];
  });
  const added = finished.reduce((sum, f) => sum + f.result.added, 0);
  const already = finished.reduce((sum, f) => sum + f.result.alreadySaved, 0);
  const unavailable = finished.reduce((sum, f) => sum + f.result.unavailable, 0);
  const unratedAdded = finished.filter((f) => f.row.mode.kind === "plain").reduce((sum, f) => sum + f.result.added, 0);

  const groups = new Map<string, { mode: ImportMode; count: number; names: string[] }>();
  for (const { row, result } of finished) {
    const key = modeToValue(row.mode);
    const g = groups.get(key) ?? { mode: row.mode, count: 0, names: [] };
    g.count += result.added + result.alreadySaved;
    g.names.push(row.name);
    groups.set(key, g);
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-col items-start gap-3 px-5 pt-6 pb-7">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="11" fill="var(--color-ink)" />
          <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="mt-2 text-title font-bold tracking-tight">{added > 0 ? `${added}곳을 가져왔어요` : "새로 가져올 곳이 없어요"}</h2>
        {already > 0 && <p className="text-body leading-normal text-ink-2">이미 있는 {already}곳은 건너뛰었어요.</p>}
      </section>

      {groups.size > 0 && (
        <ul className="mx-5 rounded-btn-l border border-line px-4 py-1">
          {[...groups.values()].map((g) => (
            <li key={modeToValue(g.mode)} className="flex min-h-12 items-center justify-between gap-3 border-b border-line last:border-b-0">
              {g.mode.kind === "plain" ? (
                <span className="flex min-w-0 flex-col gap-0.5 py-2">
                  <span className="text-body">평가 전</span>
                  <span className="truncate text-meta text-muted">
                    리스트 {g.names.length}개 · {g.names.join(", ")}
                  </span>
                </span>
              ) : (
                <ModeChip mode={g.mode} />
              )}
              <span className="text-body font-bold">{g.count}곳</span>
            </li>
          ))}
        </ul>
      )}

      {unavailable > 0 && (
        <p className="mx-5 mt-4 rounded-btn-l bg-surface px-4 py-3.5 text-meta leading-normal text-ink-2">
          지도에 정보가 없는 곳이 {unavailable}곳 있어요. 폐업했을 수 있어요.
        </p>
      )}

      {unratedAdded > 0 && (
        <div className="mx-5 mt-4 flex flex-col gap-1 rounded-btn-l bg-surface px-4 py-3.5">
          <span className="text-body font-bold">평가 전 {unratedAdded}곳이 있어요</span>
          <span className="text-meta leading-normal text-muted">
            등급만 고르면 끝나요. 중간에 그만둬도 이어서 할 수 있어요.
          </span>
        </div>
      )}

      {failed.length > 0 && (
        <section className="mx-5 mt-4 flex flex-col gap-1 rounded-btn-l border border-line px-4 py-3">
          <h3 className="text-body font-bold">가져오지 못한 리스트</h3>
          {failed.map(({ row, error }) => (
            <p key={row.listId} className="text-meta leading-normal">
              {row.name} · <span className={ERROR_TEXT}>{error}</span>
            </p>
          ))}
        </section>
      )}

      <div className="flex-1" />
      <div className="flex flex-col gap-2 px-5 pt-3 pb-5">
        {unratedAdded > 0 ? (
          <>
            <Link href="/rate" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
              빠르게 평가하기
            </Link>
            <Link href="/home" className="flex h-btn-m items-center justify-center rounded-btn-m text-body text-ink-2">
              나중에 할게요
            </Link>
          </>
        ) : (
          <Link href="/home" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
            홈으로
          </Link>
        )}
        <button type="button" onClick={onRestart} className="h-btn-m rounded-btn-m text-body text-ink-2">
          리스트 더 가져오기
        </button>
      </div>
    </div>
  );
}
