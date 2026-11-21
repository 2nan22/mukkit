"use client";

import { useState, useTransition } from "react";
import { closeMeetup } from "./actions";

// 상대가 없으면 '취소'만, 추천이 나온 뒤엔 '끝내기'만 — 누르면 확인 한 번
export function CloseMeetup({ meetupId, mode }: { meetupId: string; mode: "cancel" | "done" | null }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  if (!mode) return null;
  const label = mode === "done" ? "약속 끝내기" : "약속 취소";
  const body = mode === "done" ? "두 사람이 넣은 위치 기록을 바로 지워요." : "약속과 링크가 사라지고, 넣은 위치 기록도 지워요.";

  if (!confirm) {
    return (
      <button type="button" onClick={() => setConfirm(true)} className="h-9 self-center text-meta text-muted underline underline-offset-[3px]">
        {label}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
      <span className="text-body font-bold">{label}할까요?</span>
      <span className="text-meta text-muted">{body}</span>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={() => setConfirm(false)} className="h-btn-m rounded-btn-m bg-white text-body font-medium text-ink">
          아니요
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => void (await closeMeetup(meetupId, mode === "done" ? "done" : "cancelled")))}
          className="h-btn-m rounded-btn-m bg-ink text-body font-bold text-white raised disabled:opacity-60"
        >
          {mode === "done" ? "끝내기" : "취소하기"}
        </button>
      </div>
    </div>
  );
}
