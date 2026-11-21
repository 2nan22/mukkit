"use client";

import { useState, useTransition } from "react";
import { removeVisit } from "./actions";

// 기록 삭제 — 확인 한 번 (각자의 평가는 그대로)
export function RemoveVisit({ visitId }: { visitId: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="h-11 px-2 text-meta text-muted">
        기록 삭제
      </button>
    );
  }
  return (
    <span className="flex flex-1 items-center justify-end gap-1">
      <span className="mr-auto text-meta text-ink-2">이 기록을 삭제할까요?</span>
      <button type="button" onClick={() => setConfirm(false)} className="h-11 px-2 text-meta text-muted">
        취소
      </button>
      <button type="button" disabled={pending} onClick={() => start(async () => void (await removeVisit(visitId)))} className="h-11 px-2 text-meta font-semibold text-danger disabled:opacity-50">
        삭제
      </button>
    </span>
  );
}
