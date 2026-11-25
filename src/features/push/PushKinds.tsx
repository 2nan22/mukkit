"use client";

import { useState, useTransition } from "react";
import { setPushOff } from "./actions";
import { PushToggle } from "./PushToggle";

const KINDS = [
  { kind: "meetup", label: "약속", desc: "초대, 새 참여자, 추천 지역" },
  { kind: "comment", label: "댓글", desc: "내 평가, 내가 댓글 단 평가" },
  { kind: "like", label: "좋아요", desc: "누가 내 평가를 좋아했을 때" },
  { kind: "visit", label: "함께 방문", desc: "누가 나와 함께 갔다고 남겼을 때" },
  { kind: "follow", label: "팔로우", desc: "누가 나를 팔로우했을 때" },
] as const;

// 설정 › 알림 — 이 기기 알림 켜기 + 종류별로 끄기. 기기 알림이 꺼져 있으면 종류 목록은 흐리게
export function NotificationSettings({ initialOff }: { initialOff: string[] }) {
  const [deviceOn, setDeviceOn] = useState<boolean | null>(null);
  return (
    <>
      <section className="px-5">
        <PushToggle variant="row" onState={setDeviceOn} />
      </section>
      <section className="flex flex-col px-5 pt-6">
        <h2 className="text-meta text-muted">받을 알림</h2>
        {deviceOn === false && <p className="pb-1 text-caption text-subtle">이 기기 알림을 켜면 받을 수 있어요</p>}
        <div className={deviceOn === false ? "opacity-50" : ""}>
          <PushKinds initialOff={initialOff} />
        </div>
      </section>
    </>
  );
}

// 종류별로 끄기. 누르면 바로 저장
function PushKinds({ initialOff }: { initialOff: string[] }) {
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
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors before:absolute before:-inset-2 before:content-[''] disabled:opacity-50 ${on ? "bg-ink" : "bg-line-strong"}`}
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
