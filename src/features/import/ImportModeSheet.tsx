"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TierBadge } from "@/components/ui/TierBadge";
import { TIER_MEANING, tierFromDb } from "@/domain/tier";
import { RATING_VISIBILITIES, type NoteVisibility, type RatingVisibility } from "@/features/rating/rating";
import { VISIBILITY } from "@/features/rating/VisibilitySheet";
import { NoteVisibilityPicker } from "@/features/rating/NoteVisibilityPicker";
import { IMPORT_TIERS, modeToValue, type ImportMode } from "./importMode";

export type RowChoice = { mode: ImportMode; visibility?: RatingVisibility; noteVisibility?: NoteVisibility };

const RATED: string[] = ["three", "two", "one", "not_recommended"];
export const isRatedMode = (mode: ImportMode) => mode.kind === "tier" && RATED.includes(mode.tier);

const OPTION =
  "flex min-h-13 cursor-pointer items-center gap-3 rounded-[12px] border border-line px-3.5 py-2 has-checked:border-[1.5px] has-checked:border-ink has-focus-visible:ring-2 has-focus-visible:ring-ink has-focus-visible:ring-offset-2";

// 리스트 하나를 어떻게 가져올지 — 등급(아이콘 · 뜻)과, 다녀온 등급이면 공개 범위 · 메모까지 이 리스트만 (68-4)
// 고르면 바로 반영 · 닫기는 확인 · 바깥 · Esc 모두 같음 (공개 범위를 안 골랐으면 줄에 '공개 범위 고르기'가 남는다)
export function ImportModeSheet({ name, value, onChange, onClose }: { name: string; value: RowChoice; onChange: (v: RowChoice) => void; onClose: () => void }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    const picked = sheet.current?.querySelector<HTMLInputElement>('input[name="import-mode"]:checked');
    (picked ?? sheet.current)?.focus();
  }, []);
  const current = modeToValue(value.mode);
  const rated = isRatedMode(value.mode);
  // 다녀온 등급이 아니면 공개 범위 · 메모는 지운다 — 다시 등급으로 바꿨을 때 옛 값이 되살아나지 않게
  const pick = (mode: ImportMode) => onChange(isRatedMode(mode) ? { ...value, mode } : { mode });
  const option = (key: string, mode: ImportMode, badge: React.ReactNode, meaning: string) => (
    <label key={key} className={OPTION}>
      <input type="radio" name="import-mode" value={key} checked={current === key} onChange={() => pick(mode)} className="sr-only" />
      <span className="w-[92px] shrink-0">{badge}</span>
      <span className="flex-1 text-meta text-ink-2">{meaning}</span>
    </label>
  );
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={onClose}>
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mode-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex max-h-[90dvh] w-full max-w-[480px] flex-col rounded-t-[20px] bg-white outline-none"
      >
        <div className="flex flex-col gap-1 px-5 pt-2">
          <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
          <h2 id="mode-title" className="pt-2 text-section font-bold">
            어떻게 가져올까요?
          </h2>
          <p className="truncate text-meta text-muted">{name}</p>
        </div>
        <div className="flex flex-col gap-1.5 overflow-y-auto px-5 pt-3 pb-2">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="sr-only">가져올 방식</legend>
            {option("plain", { kind: "plain" }, <TierBadge tier="unrated" />, "저장만 하고 이 이름으로 리스트를 만들어요")}
            <p className="pt-3 pb-0.5 text-caption font-semibold text-muted">이 리스트 전부 한 등급으로</p>
            {IMPORT_TIERS.map((t) => option(t, { kind: "tier", tier: t }, <TierBadge tier={tierFromDb(t)} />, TIER_MEANING[tierFromDb(t)]))}
          </fieldset>
          {rated && (
            <fieldset className="meet-rise mt-4 flex flex-col gap-2 border-t border-line pt-4">
              <legend className="float-left w-full pb-2 text-body font-semibold">누구에게 보여 줄까요?</legend>
              <div className="grid grid-cols-3 gap-1.5">
                {RATING_VISIBILITIES.map((v) => (
                  <label key={v} className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] bg-surface text-meta font-semibold text-ink-2 has-checked:bg-ink has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-ink has-focus-visible:ring-offset-2">
                    <input type="radio" name="row-visibility" value={v} checked={value.visibility === v} onChange={() => onChange({ ...value, visibility: v })} className="sr-only" />
                    {VISIBILITY[v].label}
                  </label>
                ))}
              </div>
              <div className="pt-2">
                <NoteVisibilityPicker title="지도 앱 메모는 누가 볼까요?" value={value.noteVisibility ?? "same"} onChange={(v) => onChange({ ...value, noteVisibility: v })} rating={value.visibility ?? null} warn />
              </div>
            </fieldset>
          )}
        </div>
        <div className="px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} className="h-btn-l w-full rounded-btn-l bg-ink text-[16px] font-bold text-white">
            확인
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
