"use client";

import { useEffect } from "react";

// 화면 아래 잠깐 뜨는 알림 — 되돌리기 같은 한 가지 행동만
export function Toast({ message, action, onAction, onClose, duration = 5000 }: { message: string; action?: string; onAction?: () => void; onClose: () => void; duration?: number }) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration, message]);

  return (
    <div role="status" className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-[calc(100%-32px)] max-w-[448px] items-center justify-between gap-3 rounded-[12px] bg-ink px-4 py-3 text-meta text-white shadow-float">
      <span className="min-w-0 truncate">{message}</span>
      {action && onAction && (
        <button type="button" onClick={onAction} className="h-8 shrink-0 font-bold text-[#ffb38a]">
          {action}
        </button>
      )}
    </div>
  );
}
