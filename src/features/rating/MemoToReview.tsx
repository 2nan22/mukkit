"use client";

import { useState, useTransition } from "react";
import { copyImportedMemosToReview } from "./actions";

// 설정 › 평가 공개 범위 — 가져온 메모를 한 줄 평가로 (68-2). 피드 · 장소에는 한 줄 평가만 보이고 메모는 나만 보므로
export function MemoToReview({ count }: { count: number }) {
  const [left, setLeft] = useState(count);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (count === 0 && !message) return null;
  return (
    <section className="flex flex-col gap-2 border-t-8 border-surface px-5 pt-6 pb-8">
      <h2 className="text-section font-bold">가져온 메모를 한 줄 평가로</h2>
      <p className="text-meta leading-normal text-ink-2">한 줄 평가는 공개 범위대로 피드 · 장소에서 보여요. 나만 보는 메모는 그대로 남아요.</p>
      <p className="rounded-[12px] bg-surface px-3.5 py-3 text-meta leading-normal text-ink-2">전화번호처럼 남에게 보이면 안 되는 내용이 메모에 있으면 먼저 지워 주세요. 옮긴 뒤에도 평가에서 고치거나 지울 수 있어요.</p>
      {message && (
        <p role="status" className="text-meta text-ink-2">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={left === 0 || pending}
        onClick={() =>
          start(async () => {
            const res = await copyImportedMemosToReview();
            if (res.error) return setMessage(res.error);
            setLeft(0);
            setMessage(`${res.copied ?? 0}곳의 메모를 한 줄 평가로 옮겼어요`);
          })
        }
        className="mt-1 h-btn-m rounded-btn-m bg-surface text-body font-semibold text-ink disabled:opacity-40"
      >
        {pending ? "옮기는 중" : `${left.toLocaleString("ko-KR")}곳 옮기기`}
      </button>
    </section>
  );
}
