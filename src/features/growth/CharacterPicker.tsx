"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Character, CHARACTER_INFO, CHARACTERS, type CharacterId } from "@/components/growth/Character";
import { chooseCharacter } from "./actions";

// 셋 중 하나 고르기 — 고른 뒤에도 레벨 화면에서 바꿀 수 있다
// done: 고른 뒤 갈 곳 (가입 흐름) — 없으면 이 화면을 다시 그린다
export function CharacterPicker({ current = null, stage = 1, done }: { current?: CharacterId | null; stage?: number; done?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function pick(id: CharacterId) {
    if (id === current) return;
    start(async () => {
      const res = await chooseCharacter(id);
      setError(res.error ?? null);
      if (res.error) return;
      if (done) router.replace(done);
      else router.refresh();
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="캐릭터" className="grid grid-cols-3 gap-2">
        {CHARACTERS.map((id) => {
          const on = id === current;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => pick(id)}
              className={`flex flex-col items-center gap-1 rounded-[14px] border px-2 pt-2 pb-2.5 disabled:opacity-60 ${on ? "border-ink" : "border-line"}`}
            >
              <Character id={id} stage={stage} branch={null} size={64} />
              <span className="text-body font-bold">{CHARACTER_INFO[id].name}</span>
              <span className="text-caption leading-snug text-muted">{CHARACTER_INFO[id].line}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
