"use client";

import Link from "next/link";
import { useState, type ChangeEvent } from "react";
import { importGoogleList, type GoogleImportResult, type MissReason } from "./actions";
import { readTakeoutFiles, type GoogleList, type TakeoutFile } from "./takeout";

// 구글 지도 저장 리스트 가져오기 (76) — ① 테이크아웃에서 받기 ② 파일 올리기 ③ 리스트 골라 가져오기
// 파일은 기기에서 풀고 읽는다. 서버엔 리스트마다 가게 이름 · 메모 · 좌표 · 주소만
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MISS_LABEL: Record<MissReason, string> = {
  not_found: "카카오맵에서 찾지 못했어요",
  ambiguous: "같은 이름 가게가 여러 곳이에요",
  not_food: "음식점이나 카페가 아니에요",
  failed: "찾는 중에 문제가 생겼어요",
};

type Row = { list: GoogleList; on: boolean; result?: GoogleImportResult };

async function readFiles(files: FileList): Promise<TakeoutFile[]> {
  const out: TakeoutFile[] = [];
  for (const file of Array.from(files)) {
    if (file.size > MAX_FILE_BYTES) continue;
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
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const done = rows?.some((r) => r.result) ?? false;

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setReading(true);
    setError(null);
    try {
      const lists = readTakeoutFiles(await readFiles(files));
      if (lists.length === 0) setError("구글 지도 저장 리스트를 찾지 못했어요. 테이크아웃에서 받은 파일인지 확인해 주세요.");
      setRows(lists.length > 0 ? lists.map((list) => ({ list, on: true })) : null);
    } catch {
      setError("파일을 열지 못했어요. 받은 zip 파일을 그대로 올려 주세요.");
    } finally {
      setReading(false);
      e.target.value = "";
    }
  }

  async function run() {
    if (!rows) return;
    const picked = rows.map((r, i) => [r, i] as const).filter(([r]) => r.on && !r.result);
    for (const [r, i] of picked) {
      setRunning(i);
      const result = await importGoogleList(r.list).catch((): GoogleImportResult => ({ ok: false, error: "가져오지 못했어요. 다시 시도해 주세요." }));
      setRows((cur) => cur && cur.map((x, j) => (j === i ? { ...x, result } : x)));
    }
    setRunning(null);
  }

  const picked = rows?.filter((r) => r.on && !r.result).length ?? 0;
  const total = rows?.filter((r) => r.on).reduce((n, r) => n + r.list.items.length, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6 px-5 pt-2 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold">1. 구글에서 파일 받기</h2>
        <ol className="flex flex-col gap-3">
          {[
            <>
              <b>구글 테이크아웃</b>을 열어요
            </>,
            <>
              <b>모두 선택 해제</b>를 누르고 <b>저장됨</b>만 체크해요
            </>,
            <>
              맨 아래 <b>다음 단계 › 내보내기 생성</b>을 눌러요. 몇 분 뒤 메일로 파일이 와요
            </>,
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-caption font-bold text-white">{i + 1}</span>
              <span className="pt-0.5 text-body leading-normal">{step}</span>
            </li>
          ))}
        </ol>
        <a
          href="https://takeout.google.com/"
          target="_blank"
          rel="noreferrer"
          className="flex h-btn-m items-center justify-center gap-1 self-start rounded-btn-m bg-surface px-4 text-body font-semibold text-ink"
        >
          구글 테이크아웃 열기
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
        <p className="text-meta text-muted">별표 표시한 장소도 가져오려면 지도(내 장소)도 함께 체크해요</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-section font-bold">2. 받은 파일 올리기</h2>
        <label className={`flex min-h-14 cursor-pointer items-center justify-center rounded-[14px] border border-dashed border-line-strong px-4 text-body font-semibold text-ink ${reading ? "opacity-60" : ""}`}>
          {reading ? "파일 읽는 중" : rows ? "다른 파일 올리기" : "zip 파일 고르기"}
          <input type="file" accept=".zip,.csv,.json,application/zip,text/csv,application/json" multiple disabled={reading || running !== null} onChange={onFiles} className="sr-only" />
        </label>
        <p className="text-meta text-muted">메일로 받은 zip 파일을 그대로 올려요. 파일 안의 가게 이름과 메모만 읽어요</p>
        {error && (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
      </section>

      {rows && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section font-bold">3. 가져올 리스트</h2>
          <ul className="flex flex-col">
            {rows.map((r, i) => (
              <li key={r.list.key} className="flex flex-col gap-2 border-b border-line py-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={r.on}
                    disabled={Boolean(r.result) || running !== null}
                    onChange={() => setRows((cur) => cur && cur.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))}
                    className="size-5 shrink-0 accent-ink"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-semibold">{r.list.name}</span>
                    <span className="text-meta text-muted">
                      {r.list.items.length}곳 {r.list.wantToGo ? "가고 싶은 곳으로 저장" : "리스트로 저장"}
                    </span>
                  </span>
                  {running === i && <span className="shrink-0 text-meta text-muted">가져오는 중</span>}
                </label>
                {r.result && <ResultLine result={r.result} />}
              </li>
            ))}
          </ul>
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
        {result.added}곳 새로 저장{result.alreadySaved > 0 ? `, ${result.alreadySaved}곳은 이미 있어요` : ""}
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
          <Link href="/search" className="mt-2 inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-[3px]">
            검색해서 직접 추가하기
          </Link>
        </details>
      )}
    </div>
  );
}
