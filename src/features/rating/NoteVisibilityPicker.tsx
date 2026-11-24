"use client";

import { useId } from "react";
import { NOTE_VISIBILITIES, type NoteVisibility, type RatingVisibility } from "./rating";
import { noteAudience } from "./noteAudience";

const LABEL: Record<NoteVisibility, string> = { same: "평가와 같게", private: "나만", followers: "팔로워", public: "전체" };

// 메모는 누가 볼까요? — 기본 평가와 같게, 나만 · 팔로워 · 전체도 (68-5). 개수가 정해진 4개라 같은 칸(칩 줄 규칙)
export function NoteVisibilityPicker({ value, onChange, rating, title = "메모는 누가 볼까요?", onSurface = false }: { value: NoteVisibility; onChange: (v: NoteVisibility) => void; rating: RatingVisibility | null; title?: string; onSurface?: boolean }) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="float-left w-full pb-1.5 text-meta font-semibold text-ink-2">{title}</legend>
      <div className="grid grid-cols-4 gap-1">
        {NOTE_VISIBILITIES.map((v) => (
          <label
            key={v}
            className={`flex h-10 cursor-pointer items-center justify-center rounded-[10px] px-1 ${onSurface ? "bg-white" : "bg-surface"} text-[13px] font-semibold whitespace-nowrap text-ink-2 has-checked:bg-ink has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-ink has-focus-visible:ring-offset-2`}
          >
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="sr-only" />
            {LABEL[v]}
          </label>
        ))}
      </div>
      <span className="text-caption text-muted">{rating ? noteAudience(rating, value) : "등급 공개 범위를 고르면 같이 정해져요"}</span>
    </fieldset>
  );
}
