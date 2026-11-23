"use client";

import { useActionState } from "react";
import { agreeToTerms, type AgreeState } from "./actions";
import { AgreeCheck } from "./AgreeCheck";

export function AgreeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AgreeState, FormData>(agreeToTerms, {});
  return (
    <form action={action} className="flex flex-1 flex-col gap-3">
      <input type="hidden" name="next" value={next} />
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
