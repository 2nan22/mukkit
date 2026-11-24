"use client";

import { useState, useTransition } from "react";
import { publishImportedMemos } from "./actions";

// 설정 › 평가 공개 범위 — 지도 앱에서 가져온 메모를 한 번에 공개 (68-4). 메모는 기본 나만이라
export function PublishMemos({ count }: { count: number }) {
  const [left, setLeft] = useState(count);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (count === 0 && !message) return null;
  return (
    <section className="flex flex-col gap-2 border-t-8 border-surface px-5 pt-6 pb-8">
      <h2 className="text-section font-bold">가져온 메모 공개</h2>
      <p className="text-meta leading-normal text-ink-2">지도 앱에서 가져온 메모를 평가 공개 범위대로 피드 · 장소에 보여 줘요. 먹킷에서 직접 쓴 메모는 그대로 나만 봐요.</p>
      <p className="rounded-[12px] bg-surface px-3.5 py-3 text-meta leading-normal text-ink-2">전화번호처럼 남에게 보이면 안 되는 내용이 메모에 있으면 먼저 지워 주세요. 공개한 뒤에도 평가 수정에서 메모마다 다시 나만으로 바꿀 수 있어요.</p>
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
            const res = await publishImportedMemos();
            if (res.error) return setMessage(res.error);
            setLeft(0);
            setMessage(`${res.published ?? 0}곳의 메모를 공개했어요`);
          })
        }
        className="mt-1 h-btn-m rounded-btn-m bg-surface text-body font-semibold text-ink disabled:opacity-40"
      >
        {pending ? "공개하는 중" : `${left.toLocaleString("ko-KR")}곳 메모 공개`}
      </button>
    </section>
  );
}
