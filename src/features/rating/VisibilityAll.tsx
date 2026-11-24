"use client";

import { useState, useTransition } from "react";
import { setAllRatingVisibility } from "./actions";
import type { RatingVisibility } from "./rating";

const OPTIONS: { v: RatingVisibility; label: string; desc: string }[] = [
  { v: "private", label: "나만", desc: "등급 · 한 줄 평가 · 사진 모두 나만" },
  { v: "followers", label: "팔로워", desc: "나를 팔로우하는 사람 피드에" },
  { v: "public", label: "전체 공개", desc: "프로필 · 공유 리스트에서 누구나" },
];

// 설정 › 평가 공개 범위 (68) — 지금까지 평가한 곳을 한 번에. 고르고 '바꾸기'를 한 번 더 눌러야 바뀐다
export function VisibilityAll({ counts }: { counts: Record<RatingVisibility, number> }) {
  const total = counts.private + counts.followers + counts.public;
  const [picked, setPicked] = useState<RatingVisibility | null>(null);
  const [now, setNow] = useState(counts);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = (v: RatingVisibility) => OPTIONS.find((o) => o.v === v)!.label;

  function apply() {
    if (!picked) return;
    start(async () => {
      const res = await setAllRatingVisibility(picked);
      if (res.error) return setMessage(res.error);
      setNow({ private: 0, followers: 0, public: 0, [picked]: total });
      setMessage(`평가한 ${total}곳을 '${label(picked)}'로 바꿨어요`);
      setPicked(null);
    });
  }

  return (
    <div className="flex flex-col gap-4 px-5 pt-2 pb-8">
      <p className="text-meta leading-normal text-muted">
        평가한 {total}곳 · 나만 {now.private} · 팔로워 {now.followers} · 전체 공개 {now.public}
      </p>
      <div role="radiogroup" aria-label="바꿀 공개 범위" className="flex flex-col gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={picked === o.v}
            onClick={() => (setPicked(o.v), setMessage(null))}
            className={`flex min-h-14 items-center justify-between gap-3 rounded-[12px] border px-4 text-left ${picked === o.v ? "border-[1.5px] border-ink" : "border-line"}`}
          >
            <span className="flex flex-col">
              <span className="text-body font-semibold">{o.label}</span>
              <span className="text-meta text-muted">{o.desc}</span>
            </span>
            <span className="text-meta text-muted">{now[o.v]}곳</span>
          </button>
        ))}
      </div>
      <p className="text-caption leading-normal text-muted">메모는 언제나 나만 봐요 · 가고 싶은 곳 · 평가 전은 남에게 보이지 않아요 · 앞으로 평가할 때는 평가 화면에서 따로 정해요</p>
      {message && (
        <p role="status" className="text-meta text-ink-2">
          {message}
        </p>
      )}
      <button type="button" disabled={!picked || pending || total === 0} onClick={apply} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-40 raised-brand">
        {pending ? "바꾸는 중" : picked ? `평가한 ${total}곳 모두 '${label(picked)}'로 바꾸기` : "바꿀 공개 범위를 골라 주세요"}
      </button>
    </div>
  );
}
