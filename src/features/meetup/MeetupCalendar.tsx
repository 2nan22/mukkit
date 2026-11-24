"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PURPOSE_LABEL } from "@/domain/meetup";
import type { MeetupListItem } from "./meetup";
import { MetaLine } from "@/components/ui/MetaLine";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

// 한국 시간 날짜 열쇠 — 2026-11-21
function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
}

function monthStart(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

function fmt(iso: string, o: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...o }).format(new Date(iso));
}

function title(m: MeetupListItem): string {
  const purpose = PURPOSE_LABEL[m.purpose];
  if (m.invited) return `${m.hostNickname}님의 ${purpose} 초대`;
  if (m.others.length === 0) return `${purpose}, 함께할 분을 기다리는 중`;
  const who = m.others.length === 1 ? `${m.others[0]}님과` : `${m.others[0]}님 외 ${m.others.length - 1}명과`;
  return `${who} ${purpose}`;
}

function Row({ m, timeOnly }: { m: MeetupListItem; timeOnly: boolean }) {
  const when = !m.startsAt
    ? "시간 미정"
    : timeOnly
      ? fmt(m.startsAt, { hour: "numeric", minute: "2-digit" })
      : fmt(m.startsAt, { month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit" });
  return (
    <li>
      <Link href={`/meet/${m.id}`} className="flex min-h-16 items-center gap-3 border-b border-line py-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="row-title truncate text-body font-semibold">{title(m)}</span>
          <MetaLine items={[when, m.status !== "open" && (m.status === "done" ? "끝남" : "취소"), m.invited && "수락 기다리는 중"]} />
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="shrink-0 text-subtle" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </li>
  );
}

function isPast(m: MeetupListItem, today: string): boolean {
  return m.status !== "open" || (m.startsAt !== null && dayKey(new Date(m.startsAt)) < today);
}

function monthKey(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

function Arrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={dir === "prev" ? "이전 달" : "다음 달"} className="flex size-10 items-center justify-center rounded-full text-ink disabled:text-line-strong">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

function List({ title, items, timeOnly, muted }: { title: string; items: MeetupListItem[]; timeOnly: boolean; muted?: boolean }) {
  return (
    <section className="flex flex-col">
      <h2 className="flex h-8 items-center text-[16px] font-bold">{title}</h2>
      <ul className={`flex flex-col ${muted ? "[&_.row-title]:text-muted" : ""}`}>
        {items.map((m) => (
          <Row key={m.id} m={m} timeOnly={timeOnly} />
        ))}
      </ul>
    </section>
  );
}

// 약속 달력 — 약속 있는 날에 점, 날짜를 누르면 그날 약속만
export function MeetupCalendar({ meetups }: { meetups: MeetupListItem[] }) {
  const today = dayKey(new Date());
  const thisMonth = monthStart(today);
  const [month, setMonth] = useState(thisMonth);
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, MeetupListItem[]>();
    for (const m of meetups) {
      if (!m.startsAt) continue;
      const k = dayKey(new Date(m.startsAt));
      map.set(k, [...(map.get(k) ?? []), m]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt!.localeCompare(b.startsAt!));
    return map;
  }, [meetups]);

  // 다가오는 약속(날짜순 · 시간 미정은 뒤) / 지난 약속(최신순)
  const { upcoming, past } = useMemo(() => {
    const up = meetups.filter((m) => !isPast(m, today)).sort((a, b) => (a.startsAt ?? "9").localeCompare(b.startsAt ?? "9"));
    const gone = meetups.filter((m) => isPast(m, today)).sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""));
    return { upcoming: up, past: gone };
  }, [meetups, today]);

  // 달 이동은 약속이 있는 달 ~ 이번 달 범위 안에서만
  const months = [...byDay.keys()].map((k) => monthKey(monthStart(k)));
  const minMonth = Math.min(monthKey(thisMonth), ...months);
  const maxMonth = Math.max(monthKey(thisMonth), ...months);
  const current = monthKey(month);

  const y = month.getUTCFullYear();
  const mo = month.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(month.getUTCDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const prefix = `${y}-${String(mo + 1).padStart(2, "0")}-`;
  const monthEmpty = ![...byDay.keys()].some((k) => k.startsWith(prefix));
  const go = (d: Date) => {
    setMonth(d);
    setSelected(null);
  };
  const [, sm, sd] = (selected ?? "").split("-").map(Number);

  return (
    <div className="flex flex-col gap-5">
      <div className="mx-5 flex flex-col gap-1 rounded-[16px] bg-surface px-3 py-2">
        <div className="flex items-center gap-1">
          <Arrow dir="prev" disabled={current <= minMonth} onClick={() => go(new Date(Date.UTC(y, mo - 1, 1)))} />
          <span aria-live="polite" className="flex-1 text-center text-body font-bold">
            {y}년 {mo + 1}월
          </span>
          <Arrow dir="next" disabled={current >= maxMonth} onClick={() => go(new Date(Date.UTC(y, mo + 1, 1)))} />
        </div>
        {current !== monthKey(thisMonth) && (
          <button type="button" onClick={() => go(thisMonth)} className="mx-auto h-8 rounded-full border border-line bg-white px-3 text-meta font-semibold text-ink">
            오늘
          </button>
        )}
        <div aria-hidden="true" className="grid grid-cols-7 text-center text-caption font-medium">
          {WEEK.map((w, i) => (
            <span key={w} className={`py-1 ${i === 0 ? "text-[#c94a4a]" : i === 6 ? "text-[#3b6fc4]" : "text-muted"}`}>
              {w}
            </span>
          ))}
        </div>
        <div role="group" aria-label={`${y}년 ${mo + 1}월 약속 달력`} className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (d === null) return <span key={`e${i}`} />;
            const key = `${prefix}${String(d).padStart(2, "0")}`;
            const items = byDay.get(key) ?? [];
            const has = items.length > 0;
            const open = items.some((m) => !isPast(m, today));
            const isSelected = key === selected;
            const isToday = key === today;
            const weekday = WEEK[(month.getUTCDay() + d - 1) % 7];
            const circle = `flex size-10 flex-col items-center justify-center rounded-full text-body ${
              isSelected ? "bg-ink font-bold text-white" : has ? "font-bold text-ink" : isToday ? "text-ink" : "text-subtle"
            } ${isToday && !isSelected ? "bg-white ring-1 ring-line-strong ring-inset" : ""}`;
            const dot = <span aria-hidden="true" className={`-mt-0.5 size-1.5 rounded-full ${!has ? "invisible" : isSelected ? "bg-white" : open ? "bg-ink" : "bg-line-strong"}`} />;
            const label = `${mo + 1}월 ${d}일 ${weekday}요일${isToday ? ", 오늘" : ""}${has ? `, 약속 ${items.length}개` : ""}`;
            if (!has) {
              return (
                <span key={d} aria-label={label} className="flex h-11 items-center justify-center">
                  <span className={circle}>
                    {d}
                    {dot}
                  </span>
                </span>
              );
            }
            return (
              <button key={d} type="button" aria-pressed={isSelected} aria-label={label} onClick={() => setSelected(isSelected ? null : key)} className="flex h-11 w-full items-center justify-center">
                <span className={circle}>
                  {d}
                  {dot}
                </span>
              </button>
            );
          })}
        </div>
        {monthEmpty && <p className="py-2 text-center text-meta text-muted">이 달에는 약속이 없어요.</p>}
      </div>

      <div className="flex flex-col gap-5 px-5" aria-live="polite">
        {selected ? (
          <section className="flex flex-col">
            <div className="flex h-8 items-center justify-between">
              <h2 className="text-[16px] font-bold">
                {sm}월 {sd}일 약속
              </h2>
              <button type="button" onClick={() => setSelected(null)} className="-mr-2 h-10 px-2 text-meta font-semibold text-ink-2">
                전체 보기
              </button>
            </div>
            <ul className="flex flex-col">
              {(byDay.get(selected) ?? []).map((m) => (
                <Row key={m.id} m={m} timeOnly />
              ))}
            </ul>
          </section>
        ) : (
          <>
            {upcoming.length > 0 ? <List title="다가오는 약속" items={upcoming} timeOnly={false} /> : <p className="py-4 text-center text-meta text-muted">다가오는 약속이 없어요.</p>}
            {past.length > 0 && <List title="지난 약속" items={past} timeOnly={false} muted />}
          </>
        )}
      </div>
    </div>
  );
}
