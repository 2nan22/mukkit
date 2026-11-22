"use client";

import { useMemo, useState, useTransition } from "react";
import { BackButton } from "@/components/BackButton";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { PlaceMap } from "@/features/map/PlaceMap";
import { addToWantToGo, setListSaved } from "./actions";
import type { PublicList } from "./publicList";

// save: 로그인한 남의 리스트일 때 — 리스트 저장 · 가게를 가고 싶은 곳으로 담기
type Save = { saved: boolean; savedPlaceIds: string[] };

export function PublicListView({ list, signedIn = false, covers = {}, save = null }: { list: PublicList; signedIn?: boolean; covers?: Record<string, string>; save?: Save | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pins = useMemo(() => list.places.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, tier: p.tier ?? "unrated" })), [list.places]);
  const [saved, setSaved] = useState(save?.saved ?? false);
  const [mine, setMine] = useState<string[]>(save?.savedPlaceIds ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const remaining = list.places.filter((p) => !mine.includes(p.placeId));

  function add(ids: string[], key: string) {
    setBusy(key);
    setMessage(null);
    start(async () => {
      const res = await addToWantToGo(list.id, ids);
      setBusy(null);
      if (res.error) return setMessage({ text: res.error, error: true });
      setMine((m) => [...new Set([...m, ...ids])]);
      setMessage({ text: ids.length === 1 ? "가고 싶은 곳에 담았어요" : `${res.added ?? ids.length}곳을 가고 싶은 곳에 담았어요` });
    });
  }
  function toggleSave() {
    const on = !saved;
    setSaved(on);
    setMessage(null);
    start(async () => {
      const res = await setListSaved(list.id, on);
      if (res.error) {
        setSaved(!on);
        setMessage({ text: res.error, error: true });
      } else setMessage({ text: on ? "리스트 탭에 저장했어요" : "저장을 풀었어요" });
    });
  }

  return (
    <>
      <div className="relative h-[42dvh] shrink-0">
        <div className="absolute inset-0">
          <PlaceMap pins={pins} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <BackButton fallback="/" className="absolute top-3 left-3 z-10 rounded-full bg-white shadow-float" />
      </div>
      <ul className="flex flex-col px-5 pt-2">
        {list.places.map((p) => (
          <li key={p.placeId}>
            <PlaceRow
              // 로그인한 사람은 장소 상세로, 아니면 지도에서 짚어 보기만
              href={signedIn ? `/p/${p.placeId}` : undefined}
              thumb={covers[p.placeId]}
              onClick={() => setSelectedId(p.placeId)}
              selected={p.placeId === selectedId}
              name={p.name}
              cuisine={p.cuisine}
              tier={p.tier}
              meta={[CUISINE_LABEL[p.cuisine], p.categoryName, regionOf(p.address)].filter((v, i, a) => v && v !== "음식점" && a.indexOf(v) === i).join(" · ")}
              action={
                save &&
                (mine.includes(p.placeId) ? (
                  <span className="flex h-11 w-14 shrink-0 items-center justify-center text-meta text-muted">저장됨</span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add([p.placeId], p.placeId)}
                    aria-label={`${p.name} 가고 싶은 곳에 담기`}
                    className="flex h-11 w-14 shrink-0 items-center justify-center text-meta font-semibold text-ink disabled:opacity-50"
                  >
                    {busy === p.placeId ? "담는 중" : "담기"}
                  </button>
                ))
              }
            />
          </li>
        ))}
      </ul>
      {/* 저장 바가 기본 여백보다 높아 목록 끝이 가리지 않게 */}
      {save && <div aria-hidden="true" className="h-16" />}
      {save && (
        <div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[480px] flex-col gap-1 bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-sheet">
          <p role={message?.error ? "alert" : "status"} className={`min-h-5 text-center text-meta ${message?.error ? "text-danger" : "text-ink-2"}`}>
            {message?.text ?? ""}
          </p>
          {remaining.length > 0 && (
            <button type="button" disabled={pending} onClick={() => add(remaining.map((p) => p.placeId), "all")} className="h-11 text-meta font-semibold text-ink-2 disabled:opacity-50">
              {busy === "all" ? "담는 중" : `${remaining.length}곳 모두 가고 싶은 곳에 담기`}
            </button>
          )}
          <button
            type="button"
            disabled={pending && busy === null}
            aria-pressed={saved}
            onClick={toggleSave}
            className={`flex h-btn-l items-center justify-center gap-1.5 rounded-btn-l text-[16px] font-bold ${saved ? "border border-line-strong bg-white text-ink" : "bg-brand text-white raised-brand"}`}
          >
            {saved && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5 9-10" />
              </svg>
            )}
            {saved ? "저장한 리스트" : "리스트 저장"}
          </button>
        </div>
      )}
    </>
  );
}
