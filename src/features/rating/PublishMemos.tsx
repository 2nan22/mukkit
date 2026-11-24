"use client";

import { useState, useTransition } from "react";
import { shareImportedMemos } from "./actions";

// 설정 › 평가 공개 범위 — 나만으로 남은 지도 앱 메모를 평가와 같게 한 번에 (68-5). 그전에 가져온 메모는 나만으로 옮겨 두었으므로
export function PublishMemos({ count }: { count: number }) {
  const [left, setLeft] = useState(count);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (count === 0 && !message) return null;
  return (
    <section className="flex flex-col gap-2 border-t-8 border-surface px-5 pt-6 pb-8">
      <h2 className="text-section font-bold">가져온 메모도 평가와 같게</h2>
      <p className="text-meta leading-normal text-ink-2">지금 나만 보는 지도 앱 메모 {left.toLocaleString("ko-KR")}곳을 평가 공개 범위대로 보여 줘요. 평가가 나만인 곳은 그대로 아무도 못 봐요.</p>
      <p className="rounded-[12px] bg-surface px-3.5 py-3 text-meta leading-normal text-ink-2">전화번호처럼 남에게 보이면 안 되는 내용이 메모에 있으면 먼저 지워 주세요. 나중에 평가 수정에서 메모마다 다시 나만으로 바꿀 수 있어요.</p>
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
            const res = await shareImportedMemos();
            if (res.error) return setMessage(res.error);
            setLeft(0);
            setMessage(`${res.changed ?? 0}곳의 메모를 평가와 같게 바꿨어요`);
          })
        }
        className="mt-1 h-btn-m rounded-btn-m bg-surface text-body font-semibold text-ink disabled:opacity-40"
      >
        {pending ? "바꾸는 중" : `${left.toLocaleString("ko-KR")}곳 평가와 같게`}
      </button>
    </section>
  );
}
