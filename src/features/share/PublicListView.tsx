"use client";

import { useListSort } from "@/features/lists/ListSortBar";
import { useMemo, useState, useTransition } from "react";
import { BackButton } from "@/components/BackButton";
import { PlaceRow } from "@/components/ui/PlaceRow";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { regionOf } from "@/domain/region";
import { PlaceMap } from "@/features/map/PlaceMap";
import { addToWantToGo, setListSaved } from "./actions";
import type { PublicList } from "./publicList";

// save: 로그인한 남의 리스트일 때 — 리스트 저장 · 가게를 가고 싶은 곳으로 담기
// seenAt: 저장해 둔 리스트를 마지막으로 본 때 — 그 뒤 담긴 곳에 '새로 추가'
type Save = { saved: boolean; savedPlaceIds: string[]; seenAt: string | null };

// 아래 목록 시트가 없는 지도 — 위는 뒤로 버튼 자리만
const SHARE_MAP_PADDING = [64, 36, 36, 36] as const;

export function PublicListView({ list, signedIn = false, covers = {}, save = null }: { list: PublicList; signedIn?: boolean; covers?: Record<string, string>; save?: Save | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { shown, bar, distanceOf } = useListSort(list.places);
  // 지도도 거른 곳만 — 거르면 남은 곳에 맞춰 다시 맞춘다
  const pins = useMemo(() => shown.map((p) => ({ id: p.placeId, lat: p.lat, lng: p.lng, tier: p.tier ?? "unrated" })), [shown]);
  const [saved, setSaved] = useState(save?.saved ?? false);
  const [mine, setMine] = useState<string[]>(save?.savedPlaceIds ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean; undo?: boolean } | null>(null);
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
      setMessage({ text: ids.length === 1 ? "가고 싶은 곳으로 저장했어요" : `${res.added ?? ids.length}곳을 가고 싶은 곳으로 저장했어요` });
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
      } else setMessage(on ? { text: "리스트 탭에 저장했어요" } : { text: "저장을 풀었어요", undo: true });
    });
  }

  return (
    <>
      <div className="relative h-[42dvh] shrink-0">
        <div className="absolute inset-0">
          <PlaceMap pins={pins} selectedId={selectedId} onSelect={setSelectedId} padding={SHARE_MAP_PADDING} />
        </div>
        <BackButton fallback="/" className="absolute top-3 left-3 z-10 rounded-full bg-white shadow-float" />
      </div>
      {save && remaining.length > 0 && (
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="text-meta text-muted">내 장소에 없는 곳 {remaining.length}곳</span>
          <button type="button" disabled={pending} onClick={() => add(remaining.map((p) => p.placeId), "all")} className="h-11 text-meta font-semibold text-ink disabled:opacity-50">
            {busy === "all" ? "저장 중" : "모두 가고 싶은 곳으로 저장"}
          </button>
        </div>
      )}
      {list.places.length > 1 && <div className="px-5 pt-3">{bar()}</div>}
      <ul className="flex flex-col px-5 pt-2">
        {shown.map((p) => (
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
              meta={[distanceOf(p), CUISINE_LABEL[p.cuisine], p.categoryName, regionOf(p.address)].filter((v, i, a) => v && v !== "음식점" && a.indexOf(v) === i)}
              note={save?.seenAt && p.addedAt && new Date(p.addedAt) > new Date(save.seenAt) ? <span className="font-bold text-ink">새로 추가</span> : undefined}
              action={
                save &&
                (mine.includes(p.placeId) ? (
                  // 이미 내 장소에 있음 — 누를 수 없는 표시
                  <span role="img" aria-label="내 장소에 있음" className="flex size-11 shrink-0 items-center justify-center text-ink">
                    {flag(true)}
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => add([p.placeId], p.placeId)}
                    aria-label={`${p.name} 가고 싶은 곳으로 저장`}
                    aria-busy={busy === p.placeId}
                    className="flex size-11 shrink-0 items-center justify-center text-muted disabled:opacity-50"
                  >
                    {flag(false)}
                  </button>
                ))
              }
            />
          </li>
        ))}
      </ul>

      {save && (
        <div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-[480px] flex-col gap-1 bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-sheet">
          <div role={message?.error ? "alert" : "status"} className={message ? "flex min-h-9 items-center justify-center gap-2 text-meta" : "sr-only"}>
            <span className={message?.error ? "text-danger" : "text-ink-2"}>{message?.text ?? ""}</span>
            {message?.undo && (
              <button type="button" onClick={toggleSave} className="h-9 font-semibold text-ink underline underline-offset-[3px]">
                되돌리기
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={pending && busy === null}
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

// 가고 싶은 곳 표시 — 깃발. 채우면 이미 내 장소에 있음
function flag(filled: boolean) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 21V4h11l-2 4 2 4H6" />
    </svg>
  );
}
