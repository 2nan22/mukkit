"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { regionNameAt, removeMeetupPoint, searchMeetupPlace, setMeetupPoint, type PlaceOption } from "./actions";

const KIND_LABEL = { origin: "출발지", return: "귀가지" } as const;
const KIND_HINT = { origin: "약속 전에 있는 곳 (회사, 집 등)", return: "끝나고 돌아갈 곳" } as const;

// 출발지 · 귀가지 한 칸 — 역 · 동 검색 또는 현재 위치. 상대에게는 보이지 않는다
export function PointEditor({ meetupId, kind, current }: { meetupId: string; kind: "origin" | "return"; current: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<PlaceOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const q = query.trim();
    if (!editing || q.length < 1) return;
    const t = setTimeout(() => start(async () => setOptions(await searchMeetupPlace(q))), 300);
    return () => clearTimeout(t);
  }, [query, editing]);

  function save(label: string, lat: number, lng: number) {
    start(async () => {
      const res = await setMeetupPoint({ meetupId, kind, label, lat, lng });
      if (res.error) return setError(res.error);
      setEditing(false);
      setQuery("");
      setOptions([]);
      router.refresh();
    });
  }

  function useHere() {
    if (!navigator.geolocation) return setError("이 브라우저에서는 위치를 쓸 수 없어요");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => start(async () => save(await regionNameAt(coords.latitude, coords.longitude), coords.latitude, coords.longitude)),
      () => setError("위치를 쓸 수 없어요. 역이나 동 이름으로 찾아 주세요."),
      { maximumAge: 5 * 60 * 1000, timeout: 10_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-body font-semibold">{KIND_LABEL[kind]}</span>
          <span className="text-meta text-muted">{current ?? KIND_HINT[kind]}</span>
        </span>
        {!editing && (
          <span className="flex shrink-0 gap-1">
            {current && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => { await removeMeetupPoint(meetupId, kind); router.refresh(); })}
                className="h-8 rounded-full px-3 text-meta text-muted"
              >
                지우기
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)} className="h-8 rounded-full bg-white px-3.5 text-meta font-semibold text-ink raised-soft">
              {current ? "바꾸기" : "입력"}
            </button>
          </span>
        )}
      </div>
      {editing && (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="역이나 동 이름 (예: 망원동, 잠실역)"
            aria-label={`${KIND_LABEL[kind]} 찾기`}
            className="h-11 rounded-[12px] border border-transparent bg-white px-3.5 text-body outline-none focus:border-ink"
          />
          <button type="button" onClick={useHere} disabled={pending} className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-white text-meta font-semibold text-ink">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            현재 위치 사용
          </button>
          {options.length > 0 && (
            <ul className="flex flex-col overflow-hidden rounded-[12px] bg-white">
              {options.map((o) => (
                <li key={`${o.label}-${o.lat}`}>
                  <button type="button" onClick={() => save(o.label, o.lat, o.lng)} className="flex w-full flex-col items-start gap-0.5 border-b border-line px-3.5 py-2.5 text-left last:border-b-0">
                    <span className="text-body font-medium">{o.label}</span>
                    <span className="truncate text-meta text-muted">{o.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => { setEditing(false); setQuery(""); setOptions([]); }} className="h-9 text-meta text-muted">
            취소
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
