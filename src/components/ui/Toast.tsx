"use client";

import { useEffect, useRef, useState } from "react";

// 잠깐 뜨는 알림 — 되돌리기 같은 한 가지 행동만. 옆이나 바깥쪽으로 밀면 바로 닫힌다 (53)
// place: bottom(기본) · top — 아래에 고정 버튼이 있는 화면은 top 으로 띄워 버튼을 가리지 않게
export function Toast({
  message,
  action,
  onAction,
  onClose,
  duration = 5000,
  place = "bottom",
}: {
  message: string;
  action?: string;
  onAction?: () => void;
  onClose: () => void;
  duration?: number;
  place?: "bottom" | "top";
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  // 손을 대고 있는 동안은 저절로 닫히지 않게
  useEffect(() => {
    if (drag) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration, message, drag]);

  const outward = place === "top" ? -1 : 1;
  const end = () => {
    const d = drag;
    start.current = null;
    setDrag(null);
    // 옆으로 60px 넘게 또는 바깥쪽(아래 알림은 아래, 위 알림은 위)으로 24px 넘게 밀면 닫기
    if (d && (Math.abs(d.x) > 60 || d.y * outward > 24)) onClose();
  };

  return (
    <div
      role="status"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current) setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
      }}
      onPointerUp={end}
      onPointerCancel={end}
      style={{
        transform: drag ? `translate(${drag.x}px, ${drag.y * outward > 0 ? drag.y : 0}px)` : undefined,
        opacity: drag ? Math.max(0.3, 1 - Math.abs(drag.x) / 200) : undefined,
        transition: drag ? "none" : "transform .2s, opacity .2s",
      }}
      className={`fixed inset-x-0 z-50 mx-auto flex w-[calc(100%-32px)] max-w-[448px] touch-none items-center justify-between gap-3 rounded-[12px] bg-ink px-4 py-3 text-meta text-white shadow-float select-none ${
        place === "top" ? "top-[calc(64px+env(safe-area-inset-top))]" : "bottom-[calc(24px+env(safe-area-inset-bottom))]"
      }`}
    >
      <span className="min-w-0 leading-snug whitespace-pre-line">{message}</span>
      {action && onAction && (
        <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onAction} className="h-8 shrink-0 font-bold text-[#ffb38a]">
          {action}
        </button>
      )}
    </div>
  );
}
