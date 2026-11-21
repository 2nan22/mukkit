"use client";

import { useState, useTransition } from "react";
import { respondVisit } from "./actions";

// 받은 태그 하나 — 수락하면 내 등급을 남기러 평가 화면으로
export function TagAnswer({ visitId }: { visitId: string }) {
  const [showInFeed, setShowInFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const answer = (accept: boolean) =>
    start(async () => {
      const res = await respondVisit(visitId, accept, showInFeed);
      if (res?.error) setError(res.error);
    });
  return (
    <div className="flex flex-col gap-2">
      <label className="flex min-h-10 items-center gap-2.5">
        <input type="checkbox" checked={showInFeed} onChange={(e) => setShowInFeed(e.target.checked)} className="size-5 accent-ink" />
        <span className="text-meta text-ink-2">피드에 함께 방문 소식 보이기</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={pending} onClick={() => answer(false)} className="h-11 rounded-[12px] bg-white text-meta font-semibold text-ink-2 raised-soft disabled:opacity-50">
          거절
        </button>
        <button type="button" disabled={pending} onClick={() => answer(true)} className="h-11 rounded-[12px] bg-ink text-meta font-semibold text-white disabled:opacity-50">
          수락하고 내 등급 남기기
        </button>
      </div>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
