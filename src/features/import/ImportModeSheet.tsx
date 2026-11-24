"use client";

import { useEffect, useRef } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { Switch } from "@/components/ui/Switch";
import { TIER_MEANING, tierFromDb } from "@/domain/tier";
import { RATING_VISIBILITIES, type RatingVisibility } from "@/features/rating/rating";
import { noteAudience, VISIBILITY } from "@/features/rating/VisibilitySheet";
import { IMPORT_TIERS, modeToValue, type ImportMode } from "./importMode";

export type RowChoice = { mode: ImportMode; visibility?: RatingVisibility; notePublic?: boolean };

const RATED: string[] = ["three", "two", "one", "not_recommended"];
export const isRatedMode = (mode: ImportMode) => mode.kind === "tier" && RATED.includes(mode.tier);

// 리스트 하나를 어떻게 가져올지 — 등급(아이콘 · 뜻)과, 다녀온 등급이면 공개 범위 · 메모까지 이 리스트만 (68-4)
export function ImportModeSheet({ name, value, onChange, onClose }: { name: string; value: RowChoice; onChange: (v: RowChoice) => void; onClose: () => void }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => sheet.current?.focus(), []);
  const current = modeToValue(value.mode);
  const rated = isRatedMode(value.mode);
  const option = (key: string, mode: ImportMode, badge: React.ReactNode, meaning: string) => (
    <button
      key={key}
      type="button"
      role="radio"
      aria-checked={current === key}
      onClick={() => onChange({ ...value, mode })}
      className={`flex min-h-13 items-center gap-3 rounded-[12px] border px-3.5 py-2 text-left ${current === key ? "border-[1.5px] border-ink" : "border-line"}`}
    >
      <span className="w-[92px] shrink-0">{badge}</span>
      <span className="flex-1 text-meta text-ink-2">{meaning}</span>
    </button>
  );
  return (
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
          <div role="radiogroup" aria-labelledby="mode-title" className="flex flex-col gap-1.5">
            {option("plain", { kind: "plain" }, <TierBadge tier="unrated" />, "저장만 하고 이 이름으로 리스트를 만들어요")}
            <p className="pt-3 pb-0.5 text-caption font-semibold text-muted">이 리스트 전부 한 등급으로</p>
            {IMPORT_TIERS.map((t) => option(t, { kind: "tier", tier: t }, <TierBadge tier={tierFromDb(t)} />, TIER_MEANING[tierFromDb(t)]))}
          </div>
          {rated && (
            <div className="meet-rise mt-4 flex flex-col gap-2 border-t border-line pt-4">
              <span className="text-body font-semibold">누구에게 보여 줄까요?</span>
              <div className="grid grid-cols-3 gap-1.5">
                {RATING_VISIBILITIES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={value.visibility === v}
                    onClick={() => onChange({ ...value, visibility: v })}
                    className={`h-11 rounded-[10px] text-meta font-semibold ${value.visibility === v ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
                  >
                    {VISIBILITY[v].label}
                  </button>
                ))}
              </div>
              <Switch
                label="지도 앱 메모도 보여 주기"
                hint={value.visibility ? noteAudience(value.visibility, !!value.notePublic) : "남에게 보이면 안 되는 내용이 없을 때만 켜 주세요"}
                checked={!!value.notePublic}
                onChange={(on) => onChange({ ...value, notePublic: on })}
              />
            </div>
          )}
        </div>
        <div className="px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={onClose} disabled={rated && !value.visibility} className="h-btn-l w-full rounded-btn-l bg-ink text-[16px] font-bold text-white disabled:opacity-40">
            {rated && !value.visibility ? "누구에게 보여 줄지 골라 주세요" : "확인"}
          </button>
        </div>
      </section>
    </div>
  );
}
