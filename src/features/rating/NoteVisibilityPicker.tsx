"use client";

import { useId } from "react";
import { RATING_VISIBILITIES, type NoteVisibility, type RatingVisibility } from "./rating";
import { VISIBILITY } from "./VisibilitySheet";
import { noteAudience } from "./noteAudience";


// 메모는 누가 볼까요? — 비공개 · 팔로워 공개 · 전체 공개 세 칸, 따로 정하지 않았으면 평가 공개 범위 칸이 골라져 있다 (68-5)
// 평가와 같은 칸을 고르면 '평가와 같게'(평가 범위를 바꾸면 따라감), 다른 칸이면 그 범위로 고정 · 나만은 언제나 나만으로 고정
// warn: 가져오기 — 지도 앱 메모엔 전화번호 같은 내용이 있을 수 있어 한 줄 더
export function NoteVisibilityPicker({ value, onChange, rating, title = "메모는 누가 볼까요?", onSurface = false, warn = false }: { value: NoteVisibility; onChange: (v: NoteVisibility) => void; rating: RatingVisibility | null; title?: string; onSurface?: boolean; warn?: boolean }) {
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
            <input type="radio" name={name} value={v} checked={shown === v} onChange={() => onChange(v === rating && v !== "private" ? "same" : v)} className="sr-only" />
            {VISIBILITY[v].label}
          </label>
        ))}
      </div>
      <span className="text-caption text-muted">{rating ? noteAudience(rating, value) : "공개 범위를 먼저 골라 주세요"}</span>
      {warn && <span className="text-caption text-muted">전화번호처럼 남에게 보이면 안 되는 메모가 있으면 ‘비공개’를 골라 주세요</span>}
    </fieldset>
  );
}
