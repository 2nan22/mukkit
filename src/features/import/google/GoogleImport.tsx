"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { importGoogleList, type GoogleImportResult, type MissReason } from "./actions";
import { readTakeoutFiles, type GoogleList, type TakeoutFile } from "./takeout";

// 구글 지도 저장 리스트 가져오기 (76) — ① 테이크아웃에서 받기 ② 파일 올리기 ③ 리스트 골라 가져오기
// 파일은 기기에서 풀고 읽는다. 서버엔 리스트마다 가게 이름 · 메모 · 좌표 · 주소만
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MISS_LABEL: Record<MissReason, string> = {
  not_found: "같은 가게를 찾지 못했어요",
  ambiguous: "같은 이름 가게가 여러 곳이에요",
  not_food: "음식점이나 카페가 아니에요",
  failed: "찾는 중에 문제가 생겼어요",
};

type Row = { list: GoogleList; on: boolean; result?: GoogleImportResult };

class TooBig extends Error {}

async function readFiles(files: FileList): Promise<TakeoutFile[]> {
  const out: TakeoutFile[] = [];
  for (const file of Array.from(files)) {
    if (file.size > MAX_FILE_BYTES) throw new TooBig();
    if (/\.zip$/i.test(file.name)) {
      const { unzipSync, strFromU8 } = await import("fflate");
      const entries = unzipSync(new Uint8Array(await file.arrayBuffer()), { filter: (f) => /\.(csv|json)$/i.test(f.name) && f.originalSize < MAX_FILE_BYTES });
      for (const [name, data] of Object.entries(entries)) out.push({ name, text: strFromU8(data) });
    } else if (/\.(csv|json)$/i.test(file.name)) {
      out.push({ name: file.name, text: await file.text() });
    }
  }
  return out;
}

export function GoogleImport() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [reading, setReading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  // 다 가져온 리스트만 끝, 실패한 리스트는 다시 가져올 수 있게 (76 디자인 검토)
  const isDone = (r: Row) => r.result?.ok === true;
  const done = rows?.some(isDone) ?? false;
  const anyMissed = rows?.some((r) => r.result?.ok && r.result.missed.length > 0) ?? false;

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setReading(true);
    setError(null);
    setFileName(files.length === 1 ? files[0].name : `파일 ${files.length}개`);
    try {
      const lists = readTakeoutFiles(await readFiles(files));
      if (lists.length === 0) setError("구글 지도 저장 리스트를 찾지 못했어요. 테이크아웃에서 받은 파일인지 확인해 주세요.");
      setRows(lists.length > 0 ? lists.map((list) => ({ list, on: true })) : null);
    } catch (err) {
      setError(
        err instanceof TooBig
          ? "파일이 너무 커요. 테이크아웃에서 저장됨만 체크해 다시 받아 주세요."
          : "파일을 열지 못했어요. 받은 zip 파일을 그대로 올려 주세요.",
      );
    } finally {
      setReading(false);
      e.target.value = "";
    }
  }

  async function run() {
    if (!rows) return;
    const picked = rows.map((r, i) => [r, i] as const).filter(([r]) => r.on && !isDone(r));
    for (const [r, i] of picked) {
      setRunning(i);
      const result = await importGoogleList(r.list).catch((): GoogleImportResult => ({ ok: false, error: "가져오지 못했어요. 다시 시도해 주세요." }));
      setRows((cur) => cur && cur.map((x, j) => (j === i ? { ...x, result } : x)));
    }
    setRunning(null);
  }

  const picked = rows?.filter((r) => r.on && !isDone(r)).length ?? 0;
  const total = rows?.filter((r) => r.on && !isDone(r)).reduce((n, r) => n + r.list.items.length, 0) ?? 0;

  return (
    <div className="flex flex-col gap-8 px-5 pt-3 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* 파일을 올린 뒤엔 받는 법을 접는다 — 결과가 아래로 밀리지 않게 */}
      {/* 글자: 제목 -0.02em · 굵은 본문 -0.015em · 굵게는 단계마다 누를 버튼 이름 하나만 (79 디자인 검토) */}
      {!rows && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] leading-[1.35] font-bold tracking-[-0.02em] text-ink">구글에서 파일 받기</h2>
            <p className="text-meta leading-[1.5] tracking-[-0.01em] text-muted">구글 테이크아웃에서 저장한 장소를 파일로 받아요</p>
          </div>
          <div className="flex flex-col gap-3.5 rounded-[14px] bg-surface px-4 py-4">
            <ol className="flex flex-col gap-3.5">
              {[
                <>구글 테이크아웃을 열어요</>,
                <>
                  <b className="font-semibold text-ink">모두 선택 해제</b> 후 &lsquo;저장됨&rsquo;만 골라요
                </>,
                <>
                  맨 아래에서 <b className="font-semibold text-ink">내보내기 생성</b>을 눌러요
                </>,
                <>메일로 온 파일을 받아 여기로 돌아와요</>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[1px] flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold text-ink-2 ring-1 ring-line-strong">
                    {i + 1}
                  </span>
                  <span className="text-[15px] leading-[1.5] tracking-[-0.015em] text-ink-2">{step}</span>
                </li>
              ))}
            </ol>
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-line-strong/60 pt-3">
              <span className="text-caption leading-[1.5] text-muted">별표한 장소도 가져오려면 &lsquo;지도(내 장소)&rsquo;도 함께 골라요</span>
              <a
                href="https://takeout.google.com/"
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 shrink-0 items-center gap-1 text-meta font-semibold tracking-[-0.01em] text-ink"
              >
                테이크아웃 열기
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </a>
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] leading-[1.35] font-bold tracking-[-0.02em] text-ink">받은 파일 올리기</h2>
          <p className="text-meta leading-[1.5] tracking-[-0.01em] text-muted">가게 이름과 메모만 읽고 파일은 올리지 않아요</p>
        </div>
        <label
          className={`relative flex cursor-pointer items-center gap-3.5 rounded-[14px] border border-line-strong bg-white px-4 py-4 active:bg-surface ${reading ? "opacity-60" : ""}`}
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-surface text-ink-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M12 17v-6M9.5 13.5L12 11l2.5 2.5" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{reading ? "파일 읽는 중" : rows ? "다른 파일로 바꾸기" : "zip 파일 고르기"}</span>
            <span className="truncate text-caption text-muted">{fileName ?? "메일로 받은 파일 그대로"}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-subtle" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
          <input type="file" accept=".zip,.csv,.json,application/zip,text/csv,application/json" multiple disabled={reading || running !== null} onChange={onFiles} className="sr-only" />
        </label>
        {error && (
          <p role="alert" className="text-meta leading-[1.5] text-danger">
            {error}
          </p>
        )}
      </section>

      {rows && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[17px] leading-[1.35] font-bold tracking-[-0.02em] text-ink">가져올 리스트</h2>
          <ul className="flex flex-col">
            {rows.map((r, i) => (
              <li key={r.list.key} className="flex flex-col gap-2 border-b border-line py-3.5">
                <label className="flex items-center gap-3">
                  {isDone(r) ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-white" aria-label="가져왔어요">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={r.on}
                      disabled={running !== null}
                      onChange={() => setRows((cur) => cur && cur.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                      className="size-5 shrink-0 accent-ink"
                    />
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold tracking-[-0.015em]">{r.list.name}</span>
                    <span className="text-meta text-muted">
                      {r.list.items.length}곳, {r.list.wantToGo ? "가고 싶은 곳으로 저장" : "리스트로 담기"}
                    </span>
                  </span>
                  {running === i && <span className="shrink-0 text-meta text-muted">가져오는 중</span>}
                </label>
                {r.result && <ResultLine result={r.result} />}
              </li>
            ))}
          </ul>
          {anyMissed && (
            <Link href="/search" className="inline-flex min-h-11 items-center self-start text-meta font-semibold text-ink underline underline-offset-[3px]">
              못 찾은 곳은 검색해서 직접 추가해요
            </Link>
          )}
        </section>
      )}

      {rows && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[480px] flex-col gap-2 bg-white px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {done && picked === 0 ? (
            <Link href="/map" className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
              지도에서 보기
            </Link>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={picked === 0 || running !== null}
              className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:opacity-50"
            >
              {running !== null ? "가져오는 중" : `${total}곳 가져오기`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ResultLine({ result }: { result: GoogleImportResult }) {
  if (!result.ok) {
    return (
      <p role="alert" className="pl-8 text-meta text-danger">
        {result.error}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 pl-8">
      <p className="text-meta text-ink-2">
        {result.added === 0 && result.alreadySaved > 0
          ? "모두 이미 있어요"
          : `${result.added}곳 새로 저장${result.alreadySaved > 0 ? `, ${result.alreadySaved}곳은 이미 있어요` : ""}`}
      </p>
      {result.missed.length > 0 && (
        <details className="text-meta">
          <summary className="cursor-pointer text-muted">못 찾은 곳 {result.missed.length}곳</summary>
          <ul className="flex flex-col gap-1 pt-2">
            {result.missed.map((m, i) => (
              <li key={i} className="flex flex-col">
                <span className="text-ink">{m.name}</span>
                <span className="text-caption text-muted">{MISS_LABEL[m.reason]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
