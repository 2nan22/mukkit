"use client";

import { useTransition } from "react";
import { closeMeetup } from "./actions";

// 약속 끝내기 · 취소 — 끝내면 두 사람의 위치 기록을 바로 지운다
export function CloseMeetup({ meetupId, isHost }: { meetupId: string; isHost: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex justify-center gap-4 pt-4 text-meta text-muted">
      <button type="button" disabled={pending} onClick={() => start(async () => void (await closeMeetup(meetupId, "done")))} className="h-9 underline underline-offset-[3px]">
        약속 끝내기
      </button>
      {isHost && (
        <button type="button" disabled={pending} onClick={() => start(async () => void (await closeMeetup(meetupId, "cancelled")))} className="h-9 underline underline-offset-[3px]">
          약속 취소
        </button>
      )}
    </div>
  );
}
