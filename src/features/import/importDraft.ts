"use client";

import { useSyncExternalStore } from "react";

// 가져오기 전 담아 둔 리스트 — 네이버 · 카카오 앱을 오가거나 공유로 다시 들어와도 남게 이 기기에 둔다
// 가져오기를 마치면 비운다. 저장소가 막힌 브라우저에서는 이번 화면 동안만
const KEY = "mukkit-import-draft";
const EVENT = "mukkit-import-draft";
const EMPTY: readonly never[] = [];

let cache: unknown[] | null = null;

function read<T>(isRow: (v: unknown) => v is T): T[] {
  if (cache === null) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      cache = Array.isArray(parsed) ? parsed.filter(isRow) : [];
    } catch {
      cache = [];
    }
  }
  return cache as T[];
}

function write<T>(rows: T[]) {
  cache = rows;
  try {
    if (rows.length) localStorage.setItem(KEY, JSON.stringify(rows));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cache = null;
    cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useImportDraft<T>(isRow: (v: unknown) => v is T): [T[], (next: T[] | ((rows: T[]) => T[])) => void] {
  const rows = useSyncExternalStore(subscribe, () => read(isRow), () => EMPTY as unknown as T[]);
  const set = (next: T[] | ((rows: T[]) => T[])) => write(typeof next === "function" ? next(read(isRow)) : next);
  return [rows, set];
}

// 화면이 아직 기기 목록을 읽기 전(막 열린 직후)에도 지금 담긴 것을 확인할 때
export function peekImportDraft<T>(isRow: (v: unknown) => v is T): T[] {
  return read(isRow);
}
