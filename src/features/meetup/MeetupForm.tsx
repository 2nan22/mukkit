"use client";

import { useState, useTransition } from "react";
import { PURPOSE_LABEL, PURPOSES, type Purpose } from "@/domain/meetup";
import { createMeetup } from "./actions";

const DAYS = [
  { key: 0, label: "오늘" },
  { key: 1, label: "내일" },
  { key: 2, label: "모레" },
];
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
  const [start, setStart] = useState(19 * 60);
  const [end, setEnd] = useState(21 * 60 + 30);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (end <= start) return setError("끝나는 시간이 시작보다 뒤여야 해요");
    startTransition(async () => {
      const res = await createMeetup({ purpose, startsAt: toIso(day, start), endsAt: toIso(day, end) });
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
        <div className="flex gap-1.5">
          {DAYS.map((d) => (
            <button key={d.key} type="button" aria-pressed={day === d.key} onClick={() => setDay(d.key)} className={chip(day === d.key)}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">시작 (대략)</span>
            <select value={start} onChange={(e) => setStart(Number(e.target.value))} className={select}>
              {TIMES.slice(0, -2).map((t) => (
                <option key={t} value={t}>
                  {hhmm(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-meta text-muted">끝 (대략)</span>
            <select value={end} onChange={(e) => setEnd(Number(e.target.value))} className={select}>
              {TIMES.filter((t) => t > start).map((t) => (
                <option key={t} value={t}>
                  {t >= 24 * 60 ? `새벽 ${hhmm(t).replace("오전 ", "")}` : hhmm(t)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-meta text-muted">끝나는 시간으로 각자 막차를 어림해 귀가가 편한 지역을 골라요.</p>
      </section>

      <div className="flex-1" />
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
      <button type="button" onClick={submit} disabled={pending} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
        {pending ? "만드는 중" : "약속 만들고 링크 받기"}
      </button>
    </div>
  );
}
