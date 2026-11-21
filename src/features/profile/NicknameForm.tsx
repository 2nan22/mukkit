"use client";

import { useActionState } from "react";
import { saveNickname, type NicknameFormState } from "./actions";
import { AgreeCheck } from "@/features/legal/AgreeCheck";
import { NICKNAME_RULE } from "./nickname";

export function NicknameForm({ suggestion, next }: { suggestion: string; next: string }) {
  const [state, action, pending] = useActionState<NicknameFormState, FormData>(saveNickname, {
    value: suggestion,
  });

  return (
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="text-meta font-bold">
          닉네임
        </label>
        <input
          id="nickname"
          name="nickname"
          defaultValue={state.value}
          key={state.value}
          autoComplete="nickname"
          maxLength={12}
          required
          aria-invalid={Boolean(state.error)}
          aria-describedby="nickname-help"
          className={`h-12 rounded-btn-m border px-3.5 text-body text-ink outline-none focus:border-ink ${
            state.error ? "border-danger" : "border-line-strong"
          }`}
        />
        <p id="nickname-help" role={state.error ? "alert" : undefined} className={`text-meta ${state.error ? "text-danger" : "text-muted"}`}>
          {state.error ?? NICKNAME_RULE}
        </p>
      </div>

      <div className="flex-1" />

      <div className="pb-3">
        <AgreeCheck />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand"
      >
        {pending ? "저장하는 중" : "시작하기"}
      </button>
    </form>
  );
}
