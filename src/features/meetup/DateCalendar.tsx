"use client";

import { useState } from "react";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
export const MAX_DAYS_AHEAD = 60;

// 한국 시간 기준 오늘 0시(UTC 날짜 칸으로 다룸)
function todayKst(): Date {
  const d = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function offsetToDate(offset: number): Date {
  return new Date(todayKst().getTime() + offset * 86_400_000);
}

// 월 달력 — 오늘부터 MAX_DAYS_AHEAD 일 뒤까지 고를 수 있다. 값은 '오늘부터 며칠 뒤'
export function DateCalendar({ value, onChange }: { value: number; onChange: (offset: number) => void }) {
  const today = todayKst();
  const selected = offsetToDate(value);
  const [month, setMonth] = useState(() => new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1)));
  const last = new Date(today.getTime() + MAX_DAYS_AHEAD * 86_400_000);
  const firstWeekday = month.getUTCDay();
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const canPrev = month > new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const canNext = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)) <= last;
  const shift = (n: number) => setMonth(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + n, 1)));

  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-3">
      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => shift(-1)} disabled={!canPrev} aria-label="이전 달" className="flex size-9 items-center justify-center rounded-full text-ink disabled:opacity-25">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="text-body font-bold">
          {month.getUTCFullYear()}년 {month.getUTCMonth() + 1}월
        </span>
        <button type="button" onClick={() => shift(1)} disabled={!canNext} aria-label="다음 달" className="flex size-9 items-center justify-center rounded-full text-ink disabled:opacity-25">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-caption font-medium">
        {WEEK.map((w, i) => (
          <span key={w} className={`py-1 ${i === 0 ? "text-[#c94a4a]" : i === 6 ? "text-[#3b6fc4]" : "text-muted"}`}>
            {w}
          </span>
        ))}
      </div>
      <div role="grid" aria-label="날짜 선택" className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const date = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), d));
          const offset = Math.round((date.getTime() - today.getTime()) / 86_400_000);
          const disabled = offset < 0 || offset > MAX_DAYS_AHEAD;
          const isSelected = offset === value;
          const isToday = offset === 0;
          const weekday = date.getUTCDay();
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              aria-pressed={isSelected}
              aria-label={`${month.getUTCMonth() + 1}월 ${d}일${isToday ? " 오늘" : ""}`}
              onClick={() => onChange(offset)}
              className={`mx-auto flex size-10 flex-col items-center justify-center rounded-full text-body ${
                isSelected
                  ? "bg-brand font-bold text-white raised-brand"
                  : disabled
                    ? "text-line-strong"
                    : weekday === 0
                      ? "text-[#c94a4a]"
                      : weekday === 6
                        ? "text-[#3b6fc4]"
                        : "text-ink"
              }`}
            >
              {d}
              {isToday && !isSelected && <span aria-hidden="true" className="-mt-0.5 size-1 rounded-full bg-brand" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
