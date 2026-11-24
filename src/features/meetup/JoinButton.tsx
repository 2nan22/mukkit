"use client";

import { useState, useTransition } from "react";
import { joinMeetup } from "./actions";

export function JoinButton({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      {error && (
        <p role="alert" className="text-center text-meta text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { const res = await joinMeetup(token); if (res?.error) setError(res.error); })}
        className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand"
      >
        {pending ? "참여하는 중" : "참여하기"}
      </button>
    </>
  );
}
