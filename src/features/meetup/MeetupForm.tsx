"use client";

import { useState, useTransition } from "react";
import { PURPOSE_LABEL, PURPOSES, type Purpose } from "@/domain/meetup";
import { createMeetup } from "./actions";
import { DateCalendar, offsetToDate } from "./DateCalendar";

const DAY_NAMES = ["오늘", "내일", "모레"];
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// '오늘 21일(토)' — 한국 시간 기준
function dayLabel(offset: number): string {
  const d = offsetToDate(offset);
  return offset < DAY_NAMES.length
    ? `${DAY_NAMES[offset]} ${d.getUTCDate()}일(${WEEK[d.getUTCDay()]})`
    : `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${WEEK[d.getUTCDay()]})`;
}

function nowMinutesKst(): number {
  const d = new Date(Date.now() + 9 * 3600_000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}
// 30분 단위 · 오전 11시 ~ 새벽 2시
const TIMES = Array.from({ length: 31 }, (_, i) => 11 * 60 + i * 30);

function hhmm(m: number): string {
  const h = Math.floor(m / 60) % 24;
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(m % 60).padStart(2, "0")}`;
}

// 한국 시간 기준 날짜 + 분 → ISO (분이 24시를 넘으면 다음 날 새벽)
function toIso(dayOffset: number, minutes: number): string {
  const now = new Date(Date.now() + 9 * 3600_000);
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset) - 9 * 3600_000;
  return new Date(base + minutes * 60_000).toISOString();
}

export function MeetupForm() {
  const [purpose, setPurpose] = useState<Purpose>("meal");
  const [day, setDay] = useState(0);
  const [calendar, setCalendar] = useState(false);
  const [start, setStart] = useState(19 * 60);
  const [end, setEnd] = useState(21 * 60 + 30);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // 오늘이면 이미 지난 시각은 빼고 고른다
  const startOptions = TIMES.slice(0, -2).filter((t) => day > 0 || t > nowMinutesKst());
  // 고른 시각이 목록에 없으면(오늘 이미 지남) 첫 시각으로 — 화면과 값이 어긋나지 않게
  const startAt = startOptions.includes(start) ? start : (startOptions[0] ?? start);
  const endAt = end > startAt ? end : Math.min(startAt + 150, TIMES.at(-1)!);

  function submit() {
    if (endAt <= startAt) return setError("헤어지는 시간을 만나는 시간보다 늦게 골라 주세요");
    startTransition(async () => {
      const res = await createMeetup({ purpose, startsAt: toIso(day, startAt), endsAt: toIso(day, endAt) });
      if (res?.error) setError(res.error);
    });
  }

  const chip = (on: boolean) => `h-9 rounded-full px-3.5 text-meta font-medium ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`;
  const select = "h-12 w-full rounded-[12px] border border-transparent bg-surface px-3 text-body outline-none focus:border-ink";

  return (
    <div className="flex flex-1 flex-col gap-7 px-5 pb-5">
      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold">어떤 약속인가요</h2>
        <div className="flex flex-wrap gap-1.5">
          {PURPOSES.map((p) => (
            <button key={p} type="button" aria-pressed={purpose === p} onClick={() => setPurpose(p)} className={chip(purpose === p)}>
              {PURPOSE_LABEL[p]}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-body font-semibold">언제 만나나요</h2>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2].map((d) => (
            <button key={d} type="button" aria-pressed={!calendar && day === d} onClick={() => { setDay(d); setCalendar(false); }} className={chip(!calendar && day === d)}>
              {dayLabel(d)}
            </button>
          ))}
          <button type="button" aria-pressed={calendar || day > 2} aria-expanded={calendar} onClick={() => setCalendar((v) => !v)} className={`flex items-center gap-1 ${chip(calendar || day > 2)}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            {day > 2 ? dayLabel(day) : "다른 날"}
          </button>
        </div>
        {calendar && (
          <DateCalendar
            value={day}
            onChange={(d) => {
              setDay(d);
              setCalendar(false);
            }}
          />
        )}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">만나는 시간</span>
            <select
              value={startAt}
              onChange={(e) => {
                const v = Number(e.target.value);
                setStart(v);
                // 헤어지는 시간이 앞서게 되면 2시간 반 뒤로 맞춘다
                if (endAt <= v) setEnd(Math.min(v + 150, TIMES.at(-1)!));
              }}
              className={select}
            >
              {startOptions.map((t) => (
                <option key={t} value={t}>
                  {hhmm(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">헤어지는 시간</span>
            <select value={endAt} onChange={(e) => setEnd(Number(e.target.value))} className={select}>
              {TIMES.filter((t) => t > startAt).map((t) => (
                <option key={t} value={t}>
                  {t >= 24 * 60 ? `새벽 ${hhmm(t).replace("오전 ", "")}` : hhmm(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-meta text-muted">정확하지 않아도 돼요. 헤어지는 시간에 맞춰 막차 걱정 없는 지역을 먼저 추천해요.</p>
      </section>

      <div className="flex-1" />
      {/* 버튼은 화면 아래에 붙여 둠 — 홈 화면 앱에서 화면 높이가 실제보다 크게 잡혀도 가려지지 않게 (55) */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-white pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
        <button type="button" onClick={submit} disabled={pending} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
          {pending ? "만드는 중" : "약속 만들기"}
        </button>
      </div>
    </div>
  );
}
