"use client";

import { useActionState } from "react";
import { agreeToTerms, type AgreeState } from "./actions";
import { AgreeCheck } from "./AgreeCheck";

const SUMMARY: [string, string][] = [
  ["저장하는 것", "가져오거나 저장한 가게, 등급, 한 줄 평가, 메모, 올린 사진이에요."],
  ["보이는 범위", "평가와 메모는 고른 공개 범위대로 보여요. 메모는 평가보다 좁게 따로 정할 수 있어요."],
  ["지우기", "설정에서 탈퇴하면 기록과 사진을 모두 지워요."],
];

export function AgreeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AgreeState, FormData>(agreeToTerms, {});
  return (
    <form action={action} className="flex flex-1 flex-col gap-3">
      <input type="hidden" name="next" value={next} />
      {/* 무엇에 동의하는지 화면에서 바로 보이게 — 자세한 내용은 아래 약관 · 처리방침 링크 */}
      <ul className="flex flex-col gap-3 rounded-[16px] bg-surface p-4 text-body leading-normal text-ink-2">
        {SUMMARY.map(([title, body]) => (
          <li key={title} className="flex flex-col gap-0.5">
            <span className="font-semibold text-ink">{title}</span>
            <span className="text-meta">{body}</span>
          </li>
        ))}
      </ul>
      <div className="flex-1" />
      {/* 버튼은 화면 아래에 붙여 둠 — 홈 화면 앱에서 화면 높이가 실제보다 크게 잡혀도 가려지지 않게 (55) */}
      <div className="sticky bottom-0 z-10 flex flex-col gap-3 bg-white pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <AgreeCheck />
        {state.error && (
          <p role="alert" className="text-meta text-danger">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
          {pending ? "저장하는 중" : "동의하고 계속하기"}
        </button>
      </div>
    </form>
  );
}
