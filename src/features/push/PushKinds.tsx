"use client";

import { useState, useTransition } from "react";
import { setPushOff } from "./actions";

const KINDS = [
  { kind: "meetup", label: "약속", desc: "초대 · 참여 · 추천 지역" },
  { kind: "comment", label: "댓글", desc: "내 평가와 내가 단 댓글" },
  { kind: "visit", label: "함께 방문", desc: "같이 갔다고 남긴 요청" },
] as const;

// 설정 › 알림 — 종류별로 끄기. 누르면 바로 저장
export function PushKinds({ initialOff }: { initialOff: string[] }) {
  const [off, setOff] = useState<string[]>(initialOff);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = (kind: string) => {
    const before = off;
    const next = off.includes(kind) ? off.filter((k) => k !== kind) : [...off, kind];
    setOff(next);
    setError(null);
    start(async () => {
      const res = await setPushOff(next);
      if (res.error) {
        setOff(before);
        setError(res.error);
      }
    });
  };
  return (
    <ul className="flex flex-col">
      {KINDS.map((k) => {
        const on = !off.includes(k.kind);
        return (
          <li key={k.kind} className="flex min-h-16 items-center gap-3 border-b border-line">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold">{k.label}</span>
              <span className="text-meta text-muted">{k.desc}</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${k.label} 알림`}
              disabled={pending}
              onClick={() => toggle(k.kind)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-[''] ${on ? "bg-ink" : "bg-line-strong"}`}
            >
              <span aria-hidden="true" className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </li>
        );
      })}
      {error && (
        <li role="alert" className="pt-2 text-meta text-danger">
          {error}
        </li>
      )}
    </ul>
  );
}
