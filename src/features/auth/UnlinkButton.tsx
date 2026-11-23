"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { unlinkProvider } from "./linkActions";

// 로그인 연결 해제 — 한 번 더 묻고 해제 (그 방법으로는 로그인할 수 없게 되므로)
export function UnlinkButton({ provider, label }: { provider: string; label: string }) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="h-11 rounded-btn-m border border-line-strong px-4 text-meta text-ink-2">
        연결 해제
      </button>
    );
  }
  return (
    <form action={unlinkProvider} className="flex items-center gap-1">
      <input type="hidden" name="provider" value={provider} />
      <button type="button" onClick={() => setAsking(false)} className="h-11 px-2 text-meta text-muted">
        취소
      </button>
      <Submit label={label} />
    </form>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-label={`${label} 연결 해제 확인`} className="h-11 rounded-btn-m bg-ink px-4 text-meta font-semibold text-white disabled:opacity-50">
      {pending ? "해제 중…" : "해제"}
    </button>
  );
}
