"use client";

import { useState, useTransition } from "react";
import { setAllRatingVisibility } from "./actions";
import type { RatingVisibility } from "./rating";

const OPTIONS: { v: RatingVisibility; label: string; desc: string }[] = [
  { v: "private", label: "나만", desc: "등급, 한 줄 평가, 사진 모두 나만" },
  { v: "followers", label: "팔로워", desc: "나를 팔로우하는 사람 피드에" },
  { v: "public", label: "전체 공개", desc: "프로필과 공유 리스트에서 누구나" },
];

// 설정 › 평가 공개 범위 (68) — 지금까지 평가한 곳을 한 번에. 고르고 '모두 바꾸기'를 눌러야 바뀐다
export function VisibilityAll({ counts }: { counts: Record<RatingVisibility, number> }) {
  const total = counts.private + counts.followers + counts.public;
  const [picked, setPicked] = useState<RatingVisibility | null>(null);
  const [now, setNow] = useState(counts);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = (v: RatingVisibility) => OPTIONS.find((o) => o.v === v)!.label;
  // 이미 모두 그 범위면 바꿀 게 없다
  const nothing = !picked || now[picked] === total;

  function apply() {
    if (!picked) return;
    start(async () => {
      const res = await setAllRatingVisibility(picked);
      if (res.error) return setMessage(res.error);
      setNow({ private: 0, followers: 0, public: 0, [picked]: total });
      setMessage(`평가한 ${total}곳을 '${label(picked)}'로 바꿨어요`);
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="pb-2 text-meta text-muted">평가한 {total}곳</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.v}
            className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-line px-4 has-checked:border-[1.5px] has-checked:border-ink has-focus-visible:ring-2 has-focus-visible:ring-ink"
          >
            <input type="radio" name="visibility-all" value={o.v} checked={picked === o.v} onChange={() => (setPicked(o.v), setMessage(null))} className="sr-only" />
            <span className="flex flex-col">
              <span className="text-body font-semibold">{o.label}</span>
              <span className="text-meta text-muted">{o.desc}</span>
            </span>
            <span className="text-meta text-muted">{now[o.v]}곳</span>
          </label>
        ))}
      </fieldset>
      <p className="text-caption leading-normal text-muted">곳마다 따로 정한 공개 범위도 모두 이 값으로 바뀌어요</p>
      {message && (
        <p role="status" className="text-meta text-ink-2">
          {message}
        </p>
      )}
      <button type="button" disabled={nothing || pending || total === 0} onClick={apply} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-40 raised-brand">
        {pending ? "바꾸는 중" : "모두 바꾸기"}
      </button>
    </div>
  );
}
