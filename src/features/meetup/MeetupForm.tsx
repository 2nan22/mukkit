"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PURPOSE_LABEL, PURPOSES, type Purpose } from "@/domain/meetup";
import { createMeetup } from "./actions";
import { DateCalendar, offsetToDate } from "./DateCalendar";
import { PurposeIcon } from "./PurposeIcon";
import { timeRange } from "@/domain/meetTime";

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

// 자정을 넘긴 시각은 두 목록 모두 '새벽' — 만나는 시간에만 '오전 12:00'으로 보이던 것
export function timeLabel(m: number): string {
  return m >= 24 * 60 ? `새벽 ${hhmm(m).replace("오전 ", "")}` : hhmm(m);
}

// 한 번도 고르지 않은 헤어지는 시간은 만나는 시간에서 2시간 반 뒤 — 기본 만나는 시간이 지나 밀려도 30분짜리 약속이 되지 않게
export const DEFAULT_LENGTH = 150;
export function endFor(startAt: number, end: number, touched: boolean, last: number): number {
  if (touched && end > startAt) return end;
  return Math.min(Math.max(end, startAt + DEFAULT_LENGTH), last);
}

// 시간대 — 막차 계산에는 대략의 시간이면 충분해 시간대부터 고르고, 정확한 시각은 '시각 바꾸기' (67, 에어비앤비 · 캐치테이블)
export const BANDS = [
  { key: "lunch", label: "점심", start: 12 * 60, end: 13 * 60 + 30 },
  { key: "dinner", label: "저녁", start: 19 * 60, end: 21 * 60 + 30 },
  { key: "late", label: "늦은 밤", start: 21 * 60 + 30, end: 24 * 60 },
] as const;
type Band = (typeof BANDS)[number];

// 이 날 이 시간대를 아직 고를 수 있나 — 오늘은 시작이 지나지 않은 것만
export function bandOpen(day: number, band: Band, now: number): boolean {
  return day > 0 || band.start > now;
}

// 처음 골라 둘 날 · 시간대 — 오늘 저녁이 남았으면 오늘 저녁, 아니면 내일 저녁 (캐치테이블 '흔한 저녁' 기본값)
export function defaultWhen(now: number): { day: number; start: number; end: number } {
  const dinner = BANDS[1];
  const day = bandOpen(0, dinner, now) ? 0 : 1;
  return { day, start: dinner.start, end: dinner.end };
}

// 한국 시간 기준 날짜 + 분 → ISO (분이 24시를 넘으면 다음 날 새벽)
function toIso(dayOffset: number, minutes: number): string {
  const now = new Date(Date.now() + 9 * 3600_000);
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset) - 9 * 3600_000;
  return new Date(base + minutes * 60_000).toISOString();
}

type Step = "what" | "when" | "confirm";

// 새 약속 (67) — 한 화면에서 질문이 차례로: 답하면 위로 한 줄 요약으로 접히고 다음 질문이 올라온다 (토스 송금처럼)
export function MeetupForm() {
  const [now] = useState(nowMinutesKst);
  const init = defaultWhen(now);
  const [step, setStep] = useState<Step>("what");
  const [purpose, setPurpose] = useState<Purpose>("meal");
  const [day, setDay] = useState(init.day);
  const [calendar, setCalendar] = useState(false);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [exact, setExact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const advance = useRef<number>(0);

  // 새 질문이 올라오면 그 제목으로 포커스 — 화면 읽기 · 키보드도 다음 질문으로
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [step]);
  useEffect(() => () => window.clearTimeout(advance.current), []);

  const todayOpen = BANDS.some((b) => bandOpen(0, b, now));
  // 오늘이면 이미 지난 시각은 빼고 고른다
  const startOptions = TIMES.slice(0, -2).filter((t) => day > 0 || t > now);
  const startAt = startOptions.includes(start) ? start : (startOptions[0] ?? start);
  const endAt = endFor(startAt, end, true, TIMES.at(-1)!);
  const band = BANDS.find((b) => b.start === startAt && b.end === endAt) ?? null;

  function pickPurpose(p: Purpose) {
    setPurpose(p);
    // 고른 칸이 잠깐 보인 뒤 다음 질문으로
    window.clearTimeout(advance.current);
    advance.current = window.setTimeout(() => setStep("when"), 250);
  }
  function pickDay(d: number) {
    setDay(d);
    setCalendar(false);
    // 오늘로 바꿨는데 고른 시간대가 지났으면 남은 첫 시간대로
    const open = BANDS.filter((b) => bandOpen(d, b, now));
    if (d === 0 && !exact && band && !bandOpen(0, band, now) && open[0]) {
      setStart(open[0].start);
      setEnd(open[0].end);
    }
  }
  function pickBand(b: Band) {
    setStart(b.start);
    setEnd(b.end);
    setExact(false);
  }

  function submit() {
    if (endAt <= startAt) return setError("헤어지는 시간을 만나는 시간보다 늦게 골라 주세요");
    startTransition(async () => {
      const res = await createMeetup({ purpose, startsAt: toIso(day, startAt), endsAt: toIso(day, endAt) });
      if (res?.error) setError(res.error);
    });
  }

  const cell = (on: boolean) =>
    `flex flex-col items-center justify-center rounded-[12px] text-body font-bold leading-tight disabled:opacity-40 ${on ? "bg-ink text-white" : "bg-surface text-ink"}`;
  const select = "h-12 w-full rounded-[12px] border border-transparent bg-surface px-3 text-body outline-none focus:border-ink";

  return (
    <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
      {step !== "what" && <Answered label="약속" value={PURPOSE_LABEL[purpose]} onChange={() => setStep("what")} />}
      {step === "confirm" && <Answered label="언제" value={`${dayLabel(day)} ${timeRange(startAt, endAt)}`} onChange={() => setStep("when")} />}

      {step === "what" && (
        <section key="what" className="meet-rise flex flex-col gap-4 pt-2">
          <h2 ref={heading} tabIndex={-1} className="text-[22px] font-bold tracking-tight outline-none">
            어떤 약속이에요?
          </h2>
          <div className="grid grid-cols-5 gap-1.5">
            {PURPOSES.map((p) => (
              <button key={p} type="button" aria-pressed={purpose === p} onClick={() => pickPurpose(p)} className={`h-[76px] gap-1.5 px-0.5 text-meta ${cell(purpose === p)}`}>
                <PurposeIcon purpose={p} />
                <span className="font-medium">{PURPOSE_LABEL[p]}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "when" && (
        <section key="when" className="meet-rise flex flex-col gap-3 pt-2">
          <h2 ref={heading} tabIndex={-1} className="text-[22px] font-bold tracking-tight outline-none">
            언제 만나요?
          </h2>
          <div className="grid grid-cols-4 gap-1.5">
            {[0, 1, 2].map((d) => (
              <button key={d} type="button" disabled={d === 0 && !todayOpen} aria-pressed={!calendar && day === d} onClick={() => pickDay(d)} className={`h-[56px] ${cell(!calendar && day === d)}`}>
                {DAY_NAMES[d]}
                <span className={`text-caption font-normal ${!calendar && day === d ? "text-white/75" : "text-muted"}`}>{d === 0 && !todayOpen ? "지난 시간" : dayLabel(d).replace(/^\S+ /, "").replace("일(", " ").replace(")", "")}</span>
              </button>
            ))}
            <button type="button" aria-pressed={calendar || day > 2} aria-expanded={calendar} onClick={() => setCalendar((v) => !v)} className={`h-[56px] ${cell(calendar || day > 2)}`}>
              {day > 2 ? `${offsetToDate(day).getUTCMonth() + 1}/${offsetToDate(day).getUTCDate()}` : "다른 날"}
              <span className={`text-caption font-normal ${calendar || day > 2 ? "text-white/75" : "text-muted"}`}>달력</span>
            </button>
          </div>
          {calendar && <DateCalendar value={day} onChange={pickDay} />}
          <div className="grid grid-cols-3 gap-1.5">
            {BANDS.map((b) => (
              <button key={b.key} type="button" disabled={!bandOpen(day, b, now)} aria-pressed={!exact && band?.key === b.key} onClick={() => pickBand(b)} className={`h-11 text-body ${cell(!exact && band?.key === b.key)}`}>
                {b.label}
              </button>
            ))}
          </div>
          {exact ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-meta text-muted">만나는 시간</span>
                <select
                  value={startAt}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setStart(v);
                    // 헤어지는 시간이 앞서게 되면 2시간 반 뒤로 맞춘다
                    if (endAt <= v) setEnd(Math.min(v + DEFAULT_LENGTH, TIMES.at(-1)!));
                  }}
                  className={select}
                >
                  {startOptions.map((t) => (
                    <option key={t} value={t}>
                      {timeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-meta text-muted">헤어지는 시간</span>
                <select value={endAt} onChange={(e) => setEnd(Number(e.target.value))} className={select}>
                  {TIMES.filter((t) => t > startAt).map((t) => (
                    <option key={t} value={t}>
                      {timeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <button type="button" onClick={() => setExact(true)} className="flex h-12 items-center justify-between rounded-[12px] bg-surface px-4 text-body">
              <span>{timeRange(startAt, endAt)}</span>
              <span className="text-meta font-semibold text-ink-2 underline underline-offset-[3px]">시각 바꾸기</span>
            </button>
          )}
          <p className="text-meta text-muted">헤어지는 시간에 맞춰 막차 걱정 없는 지역을 먼저 골라요</p>
        </section>
      )}

      {step === "confirm" && (
        <section key="confirm" className="meet-rise flex flex-col gap-2 pt-4">
          <h2 ref={heading} tabIndex={-1} className="text-[22px] font-bold tracking-tight outline-none">
            이대로 만들까요?
          </h2>
          <p className="text-meta leading-normal text-muted">
            만든 뒤 친구를 초대해요.
            <br />
            각자 출발지를 넣으면 지역을 골라 드려요.
          </p>
        </section>
      )}

      <div className="flex-1" />
      {/* 버튼은 화면 아래에 붙여 둠 — 홈 화면 앱에서 화면 높이가 실제보다 크게 잡혀도 가려지지 않게 (55) */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-white pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {error && (
          <p role="alert" className="text-meta text-danger">
            {error}
          </p>
        )}
        {step === "confirm" ? (
          <button type="button" onClick={submit} disabled={pending} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
            {pending ? "만드는 중" : "약속 만들기"}
          </button>
        ) : (
          <button type="button" onClick={() => setStep(step === "what" ? "when" : "confirm")} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
            다음
          </button>
        )}
      </div>
      <span className="sr-only" aria-live="polite">
        {step === "confirm" ? `${PURPOSE_LABEL[purpose]} · ${dayLabel(day)} ${timeRange(startAt, endAt)}` : ""}
      </span>
    </div>
  );
}

// 답한 질문 — 한 줄 요약 · 바꾸기
function Answered({ label, value, onChange }: { label: string; value: string; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] bg-surface px-4 text-left">
      <span className="min-w-0 truncate text-body">
        <span className="text-muted">{label} · </span>
        <b>{value}</b>
      </span>
      <span className="shrink-0 text-meta font-semibold text-ink-2 underline underline-offset-[3px]">바꾸기</span>
    </button>
  );
}
