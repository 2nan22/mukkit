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
      <AgreeCheck />
      {state.error && (
        <p role="alert" className="text-meta text-[#c4320a]">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60">
        {pending ? "저장하는 중" : "동의하고 계속하기"}
      </button>
    </form>
  );
}
