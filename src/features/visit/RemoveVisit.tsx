"use client";

import { useState, useTransition } from "react";
import { removeVisit } from "./actions";

// 기록 빼기 — 확인 한 번
export function RemoveVisit({ visitId }: { visitId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="h-11 px-2 text-meta text-muted">
        기록 빼기
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button type="button" onClick={() => setConfirm(false)} className="h-11 px-2 text-meta text-muted">
        두기
      </button>
      <button type="button" disabled={pending} onClick={() => start(async () => void (await removeVisit(visitId)))} className="h-11 px-2 text-meta font-semibold text-danger disabled:opacity-50">
        빼기
      </button>
    </span>
  );
}
