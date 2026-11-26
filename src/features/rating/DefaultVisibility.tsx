"use client";

import { useState, useTransition } from "react";
import { setDefaultVisibility } from "./actions";
import { RATING_VISIBILITIES, type RatingVisibility } from "./rating";

const LABEL: Record<RatingVisibility, string> = { private: "비공개", followers: "팔로워 공개", public: "전체 공개" };

// 설정 › 평가 공개 범위 — 앞으로 저장 · 가져오는 곳의 기본값 (87). 누르면 바로 저장, 이미 저장한 곳은 아래 '모두 바꾸기'로
export function DefaultVisibility({ initial }: { initial: RatingVisibility | null }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pick(v: RatingVisibility) {
    const before = value;
    setValue(v);
    setError(null);
    setSaved(null);
    start(async () => {
      const res = await setDefaultVisibility(v);
      if (res.error) {
        setValue(before);
        setError(res.error);
      } else setSaved(`기본 공개 범위를 '${LABEL[v]}'로 바꿨어요`);
    });
  }

  return (
    <fieldset className="flex flex-col gap-2 px-5 pt-2 pb-6" aria-busy={pending}>
      <legend className="pb-3 text-section font-bold tracking-[-0.02em]">기본 공개 범위</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {RATING_VISIBILITIES.map((v) => (
          <label key={v} className="flex h-11 cursor-pointer items-center justify-center rounded-[10px] bg-surface text-meta font-semibold text-ink-2 has-checked:bg-ink has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-ink has-focus-visible:ring-offset-2">
            <input type="radio" name="default-visibility" value={v} checked={value === v} onChange={() => pick(v)} className="sr-only" />
            {LABEL[v]}
          </label>
        ))}
      </div>
      <span className="text-caption leading-normal text-muted">새로 저장하는 곳에 적용돼요. 고르면 바로 저장돼요</span>
      {saved && (
        <p role="status" className="text-meta text-ink-2">
          {saved}
        </p>
      )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
