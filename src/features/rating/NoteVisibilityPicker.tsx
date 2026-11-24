"use client";

import { useId } from "react";
import { RATING_VISIBILITIES, type NoteVisibility, type RatingVisibility } from "./rating";
import { noteAudience } from "./noteAudience";

const LABEL: Record<RatingVisibility, string> = { private: "나만", followers: "팔로워", public: "전체" };

// 메모는 누가 볼까요? — 나만 · 팔로워 · 전체 세 칸, 따로 정하지 않았으면 평가 공개 범위 칸이 골라져 있다 (68-5)
// 평가와 같은 칸을 고르면 '평가와 같게'(평가 범위를 바꾸면 따라감), 다른 칸이면 그 범위로 고정
export function NoteVisibilityPicker({ value, onChange, rating, title = "메모는 누가 볼까요?", onSurface = false }: { value: NoteVisibility; onChange: (v: NoteVisibility) => void; rating: RatingVisibility | null; title?: string; onSurface?: boolean }) {
  const name = useId();
  const shown = value === "same" ? rating : value;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="float-left w-full pb-1.5 text-meta font-semibold text-ink-2">{title}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {RATING_VISIBILITIES.map((v) => (
          <label
            key={v}
            className={`flex h-10 cursor-pointer items-center justify-center rounded-[10px] text-meta font-semibold text-ink-2 has-checked:bg-ink has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-ink has-focus-visible:ring-offset-2 ${onSurface ? "bg-white" : "bg-surface"}`}
          >
            <input type="radio" name={name} value={v} checked={shown === v} onChange={() => onChange(v === rating ? "same" : v)} className="sr-only" />
            {LABEL[v]}
          </label>
        ))}
      </div>
      <span className="text-caption text-muted">{rating ? noteAudience(rating, value) : "등급 공개 범위를 고르면 같이 정해져요"}</span>
    </fieldset>
  );
}
