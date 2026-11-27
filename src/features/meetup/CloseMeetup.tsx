"use client";

import { useState, useTransition } from "react";
import { cancelMeetup, closeMeetup, leaveMeetup } from "./actions";

type Action = "done" | "cancel" | "leave";

const COPY: Record<Action, { label: string; ask: string; body: string; ok: string }> = {
  done: { label: "약속 끝내기", ask: "약속을 끝낼까요?", body: "넣은 위치 기록을 바로 지우고, 어디서 만났는지 기록할 수 있어요.", ok: "끝내기" },
  cancel: { label: "약속 취소", ask: "약속을 취소할까요?", body: "함께하는 분과 초대받은 분 모두에게서 약속이 사라져요.", ok: "약속 취소하기" },
  leave: { label: "약속 나가기", ask: "약속에서 나갈까요?", body: "내가 넣은 위치를 지우고 약속 목록에서 빠져요.", ok: "나가기" },
};

// 약속 아래 작은 글자 버튼 (90) — 끝내기: 추천이 나온 뒤 누구나 · 취소: 만든 사람(언제든, 약속을 지움) · 나가기: 함께하는 사람
// 누르면 확인 한 번
export function CloseMeetup({ meetupId, canDone, role }: { meetupId: string; canDone: boolean; role: "host" | "member" | null }) {
  const [asking, setAsking] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const actions: Action[] = [...(canDone ? (["done"] as const) : []), ...(role === "host" ? (["cancel"] as const) : role === "member" ? (["leave"] as const) : [])];
  if (actions.length === 0) return null;

  if (!asking) {
    return (
      <div className="flex justify-center gap-5">
        {actions.map((a) => (
          <button key={a} type="button" onClick={() => setAsking(a)} className="h-11 text-meta text-muted underline underline-offset-[3px]">
            {COPY[a].label}
          </button>
        ))}
      </div>
    );
  }
  const c = COPY[asking];
  const run = { done: closeMeetup, cancel: cancelMeetup, leave: leaveMeetup }[asking];
  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
      <span className="text-body font-bold">{c.ask}</span>
      <span className="text-meta text-muted">{c.body}</span>
      {error && (
        <span role="alert" className="text-meta text-danger">
          {error}
        </span>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            setAsking(null);
            setError(null);
          }}
          className="h-btn-m rounded-btn-m bg-white text-body font-medium text-ink"
        >
          아니요
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await run(meetupId);
              if (res?.error) setError(res.error);
            })
          }
          className={`h-btn-m rounded-btn-m text-body font-bold text-white raised disabled:opacity-60 ${asking === "done" ? "bg-ink" : "bg-danger"}`}
        >
          {c.ok}
        </button>
      </div>
    </div>
  );
}
