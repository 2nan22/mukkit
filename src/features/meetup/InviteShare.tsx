"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = (onChange: () => void) => {
  queueMicrotask(onChange);
  return () => undefined;
};

// 약속 링크 보내기 — 휴대폰이면 공유 창(카카오톡 등), 아니면 복사
export function InviteShare({ url, title }: { url: string; title: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const canShare = useSyncExternalStore(noSubscribe, () => typeof navigator.share === "function", () => false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    } catch {
      setMessage(`복사하지 못했어요. 이 주소를 보내 주세요: ${url}`);
    }
  }

  async function share() {
    if (canShare) return navigator.share({ title, text: `${title}, 어디서 만날지 같이 정해요`, url }).catch(() => undefined);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("링크를 복사했어요. 카카오톡에 붙여 넣어 보내 주세요.");
    } catch {
      setMessage(`복사하지 못했어요. 이 주소를 보내 주세요: ${url}`);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-brand-soft p-4">
      <span className="text-body font-semibold">같이 갈 분에게 링크를 보내 주세요</span>
      <span className="text-meta leading-normal text-ink-2">상대가 위치를 넣으면 두 사람 모두 가기 편한 곳을 추천해 드려요.</span>
      <button type="button" onClick={share} className="mt-1 h-btn-m rounded-btn-m bg-brand text-body font-bold text-white raised-brand">
        {canShare ? "링크 보내기" : "링크 복사"}
      </button>
      {canShare && (
        <button type="button" onClick={copy} className="h-9 text-meta font-medium text-ink-2">
          링크 복사
        </button>
      )}
      {message && (
        <p role="status" className="break-all text-meta text-ink-2">
          {message}
        </p>
      )}
    </div>
  );
}
