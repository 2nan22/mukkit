"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { importList, previewList, type ListPreview } from "./actions";
import { extractLinks } from "./sources";
import { peekImportDraft, useImportDraft } from "./importDraft";
import { SourceMark } from "@/components/brand/BrandLogo";
import type { PlaceSourceName } from "@/domain/importedPlace";
import {
  guessMode,
  ImportModeSchema,
  modeLabel,
  modeToValue,
  type ImportMode,
} from "./importMode";
import type { ImportResult } from "./saveImportedList";
import { TierBadge } from "@/components/ui/TierBadge";
import { tierFromDb } from "@/domain/tier";
import { RATING_VISIBILITIES, type NoteVisibility, type RatingVisibility } from "@/features/rating/rating";
import { ImportModeSheet, isRatedMode, type RowChoice } from "./ImportModeSheet";
import { NoteVisibilityPicker } from "@/features/rating/NoteVisibilityPicker";

const VISIBILITY_LABEL: Record<RatingVisibility, string> = { private: "나만", followers: "팔로워", public: "전체 공개" };

// visibility · noteVisibility: 다녀온 등급으로 가져올 때 이 리스트만의 공개 범위 · 지도 앱 메모 공개 범위 (68-4 · 68-5)
type Row = ListPreview & { link: string; mode: ImportMode; visibility?: RatingVisibility; noteVisibility?: NoteVisibility };
type RowStatus = { state: "waiting" | "running" } | { state: "done"; result: ImportResult } | { state: "failed"; error: string };
type Phase = "select" | "running" | "done";

const noop = () => () => {};
// 앱 공유 시트로 받기(share_target)는 안드로이드 크롬 홈 화면 앱에서만
const isAndroid = () => /Android/i.test(navigator.userAgent);

// 기기에 남겨 둔 목록을 다시 읽을 때 — 모양이 맞는 것만
function isRow(v: unknown): v is Row {
  const r = v as Partial<Row> | null;
  return !!r && typeof r.listId === "string" && typeof r.link === "string" && typeof r.name === "string" && typeof r.count === "number" && ImportModeSchema.safeParse(r.mode).success;
}

const ERROR_TEXT = "text-danger";

// initialLink: 앱 공유 시트에서 넘어온 링크 — 바로 확인한다 · helpOpen: 링크 찾는 법을 펼친 채로 (처음 가입)
export function ImportFlow({ initialLink = "", helpOpen = false }: { initialLink?: string; helpOpen?: boolean } = {}) {
  // 담은 리스트는 이 기기에 남긴다 — 앱을 오가거나 공유로 다시 들어와도 이어서 담기
  const [draft, setRows] = useImportDraft(isRow);
  // 가져오는 동안 · 끝난 뒤 보여 줄 목록 (담아 둔 목록은 가져오기를 시작하면 비운다)
  const [ran, setRan] = useState<Row[] | null>(null);
  const rows = ran ?? draft;
  const [phase, setPhase] = useState<Phase>("select");
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  // 방금 담긴 줄 — 잠깐 강조
  const [fresh, setFresh] = useState<string[]>([]);
  const android = useSyncExternalStore(noop, isAndroid, () => false);
  // 다녀온 등급으로 가져오는 리스트는 누구에게 보여 줄지 묻는다 (68) — 모두 고를 때까지 가져오기를 막는다
  // 한 번에 정하거나 리스트마다 (68-4). 메모는 남에게 보이면 안 되는 내용이 있을 수 있어 기본은 끔
  const ratedRows = rows.filter((r) => isRatedMode(r.mode));
  const rating = ratedRows.length > 0;
  const sameVis = ratedRows.every((r) => r.visibility === ratedRows[0]?.visibility) ? (ratedRows[0]?.visibility ?? null) : null;
  const mixedVis = rating && !sameVis && ratedRows.some((r) => r.visibility);
  const noteOf = (r: Row): NoteVisibility => r.noteVisibility ?? "same";
  const sameNote = ratedRows.every((r) => noteOf(r) === noteOf(ratedRows[0])) ? (ratedRows[0] ? noteOf(ratedRows[0]) : "same") : null;
  const missing = ratedRows.some((r) => !r.visibility);
  const setAllRated = (patch: Partial<Row>) => setRows((rs) => rs.map((r) => (isRatedMode(r.mode) ? { ...r, ...patch } : r)));

  async function runImport() {
    setRan(rows);
    setPhase("running");
    setStatus(Object.fromEntries(rows.map((r) => [r.listId, { state: "waiting" }])));
    for (const row of rows) {
      setStatus((s) => ({ ...s, [row.listId]: { state: "running" } }));
      const rated = isRatedMode(row.mode);
      const res = await importList(row.link, row.mode, rated ? row.visibility : undefined, rated ? noteOf(row) : "same");
      setStatus((s) => ({
        ...s,
        [row.listId]: res.ok ? { state: "done", result: res.data } : { state: "failed", error: res.error },
      }));
      // 가져온 것만 담아 둔 목록에서 뺀다 — 실패했거나 중간에 닫으면 남아서 다시 시도할 수 있게
      if (res.ok) setRows((rs) => rs.filter((r) => r.listId !== row.listId));
    }
    setPhase("done");
  }

  if (phase === "done") {
    const restart = () => {
      setRan(null);
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
        helpOpen={helpOpen && draft.length === 0}
        quiet={rows.length > 0}
        has={(listId) => peekImportDraft(isRow).some((r) => r.listId === listId)}
        onAdd={(added) => {
          // 아래에서 모두 같게 정해 둔 공개 범위 · 메모는 새로 담긴 등급 리스트도 물려받는다
          const inherit = (a: Row): Row => (isRatedMode(a.mode) && sameVis ? { ...a, visibility: sameVis, noteVisibility: sameNote ?? "same" } : a);
          setRows((rs) => [...rs, ...added.filter((a) => !rs.some((r) => r.listId === a.listId)).map(inherit)]);
          setFresh(added.map((a) => a.listId));
          setTimeout(() => setFresh([]), 2500);
        }}
      />
      <section className="flex flex-1 flex-col px-5 pt-4">
        {rows.length === 0 ? (
          <p className="text-meta leading-normal text-muted">
            링크 여러 개도 한 번에 돼요
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between pb-1">
              <h2 className="text-section font-bold">
                리스트 {rows.length}개 <span className="font-normal text-muted">· {total}곳</span>
              </h2>
              <span className="text-caption text-muted">눌러서 등급 · 공개 범위</span>
            </div>
            <ul>
              {rows.map((row) => (
                <ListRow
                  key={row.listId}
                  row={row}
                  fresh={fresh.includes(row.listId)}
                  onChange={(v) =>
                    setRows((rs) =>
                      rs.map((r) => {
                        if (r.listId !== row.listId) return r;
                        // 평가 전 · 가고 싶은 곳에서 등급으로 바꾸면 아래에서 정해 둔 값을 물려받는다
                        const fresh = isRatedMode(v.mode) && !isRatedMode(r.mode) && !v.visibility && sameVis;
                        return { ...r, visibility: undefined, noteVisibility: undefined, ...v, ...(fresh ? { visibility: sameVis, noteVisibility: sameNote ?? "same" } : {}) };
                      }),
                    )
                  }
                  onRemove={() => setRows((rs) => rs.filter((r) => r.listId !== row.listId))}
                />
              ))}
            </ul>
          </>
        )}
        {android && (
          <p className="mt-4 flex gap-2 rounded-[12px] bg-surface px-3.5 py-3 text-meta leading-normal text-ink-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
              <path d="M12 3v12M8 7l4-4 4 4M5 13v6h14v-6" />
            </svg>
            <span>
              지도 앱에서 <b>공유 › 먹킷</b>을 눌러도 담겨요
            </span>
          </p>
        )}
      </section>
      {rows.length > 0 && (
        <div className="flex flex-col gap-3 px-5 pt-3 pb-5">
          {rating && (
            <fieldset className="flex flex-col gap-2">
              <legend className="pb-2 text-body font-semibold">가져온 등급을 누구에게 보여 줄까요?</legend>
              {mixedVis && <span className="-mt-1 pb-1 text-caption text-muted">리스트마다 다르게 정했어요 · 고르면 모두 같게 바뀌어요</span>}
              <div className="grid grid-cols-3 gap-1.5">
                {RATING_VISIBILITIES.map((v) => (
                  <label key={v} className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] bg-surface text-meta font-semibold text-ink-2 has-checked:bg-ink has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-ink has-focus-visible:ring-offset-2">
                    <input type="radio" name="import-visibility" value={v} checked={sameVis === v} onChange={() => setAllRated({ visibility: v })} className="sr-only" />
                    {VISIBILITY_LABEL[v]}
                  </label>
                ))}
              </div>
              <span className="text-caption text-muted">팔로워 이상이면 팔로우하는 사람 피드에 보여요 · 리스트마다 바꾸려면 등급을 누르세요</span>
              <div className="pt-2">
                <NoteVisibilityPicker title="지도 앱 메모는 누가 볼까요?" value={sameNote ?? "same"} onChange={(v) => setAllRated({ noteVisibility: v })} rating={sameVis} />
              </div>
            </fieldset>
          )}
          <button type="button" onClick={runImport} disabled={missing} className="h-btn-l w-full rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:opacity-40">
            {missing ? "공개 범위를 골라 주세요" : `${total}곳 가져오기`}
          </button>
        </div>
      )}
    </div>
  );
}

// quiet: 리스트가 담긴 뒤 — 주 버튼(가져오기)만 주황으로 두고 확인 버튼은 테두리로
function LinkForm({
  onAdd,
  has,
  quiet,
  initialLink,
  helpOpen,
}: {
  onAdd: (rows: Row[]) => void;
  has: (listId: string) => boolean;
  quiet: boolean;
  initialLink: string;
  helpOpen: boolean;
}) {
  const [link, setLink] = useState(initialLink);
  const form = useRef<HTMLFormElement>(null);
  // 공유 시트로 들어온 링크는 바로 확인
  useEffect(() => {
    if (initialLink) form.current?.requestSubmit();
  }, [initialLink]);
  const [pending, setPending] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<{ text: string; privateList: boolean; source: PlaceSourceName | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [showHelp, setShowHelp] = useState(helpOpen);

  // 링크가 여러 개면 하나씩 확인해 담는다 — 실패한 것만 칸에 남긴다
  async function submit(event: FormEvent) {
    event.preventDefault();
    const links = extractLinks(link);
    if (links.length === 0) return;
    setError(null);
    setNotice("");
    const failed: string[] = [];
    let firstError: typeof error = null;
    const added: Row[] = [];
    let dupes = 0;
    for (const [i, l] of links.entries()) {
      setPending({ done: i, total: links.length });
      const res = await previewList(l);
      if (res.ok) {
        if (has(res.data.listId) || added.some((a) => a.listId === res.data.listId)) dupes += 1;
        else added.push({ ...res.data, link: l, mode: guessMode(res.data.name) });
      } else {
        failed.push(l);
        firstError ??= { text: res.error, privateList: res.code === "LIST_NOT_FOUND_OR_PRIVATE", source: res.source ?? null };
      }
    }
    setPending(null);
    setLink(failed.join("\n"));
    if (failed.length && links.length > 1 && firstError) firstError = { ...firstError, text: `${links.length}개 중 ${failed.length}개를 확인하지 못했어요. ${firstError.text}` };
    setError(firstError);
    if (added.length > 0) {
      onAdd(added);
      // 리스트가 담기면 안내를 접어 담긴 리스트가 바로 보이게
      setShowHelp(false);
    }
    // 무엇이 담겼는지 늘 알린다 — 공유로 들어와 링크 하나만 담긴 경우도
    const parts = [
      added.length === 1 ? `${withObject(added[0].name)} 담았어요` : added.length > 1 ? `리스트 ${added.length}개를 담았어요` : "",
      dupes > 0 ? (added.length === 0 && dupes === 1 ? "이미 담긴 리스트예요" : `${dupes}개는 이미 담겨 있어요`) : "",
    ].filter(Boolean);
    setNotice(parts.join(" · "));
  }

  return (
    <div className="flex flex-col border-b-8 border-surface">
      <form ref={form} onSubmit={submit} className="flex flex-col gap-2 px-5 pt-3 pb-4">
        <label htmlFor="link" className="text-meta font-bold">
          공유 링크
        </label>
        <div className="flex gap-2">
          <textarea
            id="link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              form.current?.requestSubmit();
            }}
            rows={1}
            placeholder="naver.me/… 또는 kko.to/…"
            inputMode="url"
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "link-err" : undefined}
            className={`field-sizing-content max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-btn-m px-3.5 py-3 text-body leading-snug text-ink outline-none focus:border-ink ${
              error ? "border-[1.5px] border-[#d92d20]" : "border border-line-strong"
            }`}
          />
          <button
            type="submit"
            disabled={Boolean(pending)}
            className={`h-12 shrink-0 self-start rounded-btn-m px-4 text-body font-bold disabled:opacity-60 ${quiet ? "border border-ink bg-white text-ink" : "bg-brand text-white raised-brand"}`}
          >
            {pending ? (pending.total > 1 ? `확인 중 ${pending.done + 1}/${pending.total}` : "확인하는 중") : error ? "다시 시도" : "링크 확인"}
          </button>
        </div>
        {error && (
          <p id="link-err" role="alert" className={`text-meta leading-normal ${ERROR_TEXT}`}>
            {error.text}
          </p>
        )}
        <p role="status" className={notice ? "text-meta text-ink-2" : "sr-only"}>
          {notice}
        </p>
        {!error?.privateList && (
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            aria-expanded={showHelp}
            className="flex h-btn-m items-center gap-1 self-start text-meta text-muted"
          >
            공유 링크 찾는 법
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={showHelp ? "rotate-180" : ""}>
              <path d="M6 9l6 6 6-6" />
            </svg>
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
const HELP: Record<PlaceSourceName, { app: string; url: string; find: ReactNode[]; pc: ReactNode; open: ReactNode[] }> = {
  naver: {
    app: "네이버 지도",
    url: "https://map.naver.com/",
    find: [
      <><b>저장</b>에서 리스트의 <b>⋮</b>를 눌러요</>,
      <><b>공유 › 복사</b>를 눌러요 — <b>공유</b>가 없으면 비공개 리스트예요. <b>수정 › 공개 범위</b>를 <b>일부 공개</b>로 바꾸면 생겨요</>,
      <>위 칸에 붙여 넣어요</>,
    ],
    pc: <>PC에서는 리스트의 <b>⋮ › 공유</b>에서 링크 <b>복사</b></>,
    open: [
      <>네이버 지도 <b>저장</b>에서 가져올 리스트의 <b>⋮</b>를 눌러요</>,
      <><b>수정 › 공개 범위</b>를 <b>일부 공개</b>나 <b>전체 공개</b>로 바꿔요</>,
      <>다시 <b>⋮ › 공유</b>로 받은 링크를 위 칸에 넣어요</>,
    ],
  },
  kakao: {
    app: "카카오맵",
    url: "https://map.kakao.com/",
    find: [
      <><b>즐겨찾기</b>에서 그룹을 열어요</>,
      <><b>공유 › URL 복사</b>를 눌러요</>,
      <>위 칸에 붙여 넣어요</>,
    ],
    pc: <>PC에서는 그룹의 <b>⋮ › 그룹 공유</b>에서 <b>복사</b></>,
    open: [
      <>카카오맵 <b>즐겨찾기</b>에서 가져올 그룹의 <b>⋮</b>를 눌러요</>,
      <><b>그룹 수정</b>에서 <b>공개</b>로 바꿔요</>,
      <>다시 <b>공유 › URL 복사</b>로 받은 링크를 위 칸에 넣어요</>,
    ],
  },
};

// 링크 찾는 법 — 네이버 · 카카오를 탭으로. 공개 범위 문제면 그 앱 하나만
function LinkHelp({ source, privateList }: { source: PlaceSourceName | null; privateList: boolean }) {
  const [tab, setTab] = useState<PlaceSourceName>(source ?? "naver");
  const help = HELP[tab];
  const steps = privateList ? help.open : help.find;
  return (
    <div className="flex flex-col gap-4 px-5 pt-1 pb-6">
      {!source && (
        <div role="tablist" aria-label="앱 고르기" className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
          {(["naver", "kakao"] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-full text-meta ${tab === name ? "bg-white font-bold text-ink shadow-float" : "text-muted"}`}
            >
              <SourceMark source={name} size={16} />
              {HELP[name].app}
            </button>
          ))}
        </div>
      )}
      <section role={source ? undefined : "tabpanel"} aria-label={privateList ? `${help.app}에서 공개 범위 바꾸기` : `${help.app} 공유 링크 찾는 법`} className="flex flex-col gap-3.5">
        {privateList && <h2 className="text-section font-bold">{help.app}에서 공개 범위 바꾸기</h2>}
        <ol className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-caption font-bold text-white">{i + 1}</span>
              <span className="pt-0.5 text-body leading-normal">{step}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          {!privateList ? <p className="hidden text-meta text-muted sm:block">{help.pc}</p> : <span />}
          <a href={help.url} target="_blank" rel="noreferrer" className="flex h-btn-m shrink-0 items-center gap-1 text-meta font-bold text-ink">
            {help.app} 열기
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </div>
      </section>
    </div>
  );
}

// 줄 전체를 누르면 가져올 방식 시트 — 오른쪽엔 고른 등급 배지와 › (드롭다운 칩 대신, 68-5)
function ListRow({ row, fresh, onChange, onRemove }: { row: Row; fresh: boolean; onChange: (v: RowChoice) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const rated = isRatedMode(row.mode);
  const detail = rated
    ? [row.visibility ? VISIBILITY_LABEL[row.visibility] : "공개 범위 고르기", row.noteVisibility && row.noteVisibility !== "same" ? `메모 ${VISIBILITY_LABEL[row.noteVisibility]}` : null].filter(Boolean).join(" · ")
    : row.mode.kind === "plain"
      ? "리스트로 만들기"
      : null;
  return (
    <li className={`-mx-2 flex items-center rounded-[10px] border-b border-line transition-colors duration-700 ${fresh ? "bg-surface" : ""}`}>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${row.name} ${row.count}곳, 가져올 방식 ${modeLabel(row.mode)}${detail ? ` · ${detail}` : ""}, 바꾸기`}
        className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-2 pl-2 text-left"
      >
        <SourceMark source={row.source} size={20} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-semibold">{row.name}</span>
          <span className="truncate text-meta text-muted">
            {row.count}곳{detail && <span className={rated && !row.visibility ? "font-semibold text-ink" : ""}> · {detail}</span>}
          </span>
        </span>
        <TierBadge tier={row.mode.kind === "plain" ? "unrated" : tierFromDb(row.mode.tier)} />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-subtle" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      <button type="button" onClick={onRemove} aria-label={`${row.name} 빼기`} className="flex size-11 shrink-0 items-center justify-center text-subtle">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {open && (
        <ImportModeSheet
          name={row.name}
          value={{ mode: row.mode, visibility: row.visibility, noteVisibility: row.noteVisibility }}
          onChange={onChange}
          onClose={() => {
            setOpen(false);
            opener.current?.focus();
          }}
        />
      )}
    </li>
  );
}

// 이름 뒤 목적격 조사 — 받침이 있으면 '을', 없으면 '를' (한글이 아니면 '를')
function withObject(name: string): string {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  const batchim = code >= 0 && code <= 11171 && code % 28 !== 0;
  return `${name}${batchim ? "을" : "를"}`;
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
      <p className="px-5 pt-3 pb-5 text-center text-meta leading-normal text-muted">화면을 닫지 말아 주세요</p>
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
        <circle cx="12" cy="12" r="10" fill="#d92d20" />
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
  // 하나도 못 가져왔으면 성공처럼 보이지 않게
  const allFailed = finished.length === 0 && failed.length > 0;
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
        {!allFailed && (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="var(--color-ink)" />
            <path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <h2 className="mt-2 text-title font-bold tracking-tight">{allFailed ? "가져오지 못했어요" : added > 0 ? `${added}곳을 가져왔어요` : "새로 가져올 곳이 없어요"}</h2>
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
          {unavailable}곳은 폐업했을 수 있어요
        </p>
      )}

      {unratedAdded > 0 && (
        <div className="mx-5 mt-4 flex flex-col gap-1 rounded-btn-l bg-surface px-4 py-3.5">
          <span className="text-body font-bold">평가 전 {unratedAdded}곳이 있어요</span>
          <span className="text-meta leading-normal text-muted">
            등급만 고르면 돼요. 나중에 이어서 해도 돼요
          </span>
        </div>
      )}

      {failed.length > 0 && (
        <section className="mx-5 mt-4 flex flex-col gap-1 rounded-btn-l border border-line px-4 py-3">
          <h3 className="text-body font-bold">가져오지 못한 리스트</h3>
          <p className="text-meta text-muted">목록에 남겨 뒀어요</p>
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
          {failed.length > 0 ? "다시 시도" : "리스트 더 가져오기"}
        </button>
      </div>
    </div>
  );
}
