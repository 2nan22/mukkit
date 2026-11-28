"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MEETUP_TITLE_MAX } from "@/domain/meetup";
import { renameMeetup } from "./actions";

// 약속 이름 — 참여자는 눌러서 바꾼다 · 비우면 자동 이름(목적 · 함께하는 사람)으로 돌아간다 (96)
export function MeetupTitle({ meetupId, title, fallback, editable }: { meetupId: string; title: string | null; fallback: string; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await renameMeetup(meetupId, value);
      if (res?.error) return setError(res.error);
      setError(null);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 text-title font-bold break-keep tracking-[-0.02em]">{title ?? fallback}</h2>
        {editable && (
          <button
            type="button"
            onClick={() => {
              setValue(title ?? "");
              setEditing(true);
            }}
            aria-label="약속 이름 바꾸기"
            className="-mt-1.5 -mr-2.5 flex size-11 shrink-0 items-center justify-center text-muted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4z" />
              <path d="M13.5 6.5l4 4" />
            </svg>
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-meta font-semibold text-ink-2">약속 이름</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MEETUP_TITLE_MAX}
          placeholder={fallback}
          autoFocus
          enterKeyHint="done"
          className="h-12 w-full rounded-[12px] border border-transparent bg-surface px-3 text-body outline-none focus:border-ink"
        />
      </label>
      <span className="text-caption text-muted">비워 두면 기본 이름으로 보여요</span>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className="h-11 rounded-btn-m bg-surface text-body font-medium text-ink">
          취소
        </button>
        <button type="submit" disabled={pending} className="h-11 rounded-btn-m bg-ink text-body font-bold text-white disabled:opacity-60">
          {pending ? "저장하는 중" : "저장"}
        </button>
      </div>
    </form>
  );
}
