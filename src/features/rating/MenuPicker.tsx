"use client";

import { useState } from "react";
import { MENU_NAME_MAX, MENUS_MAX } from "./rating";

// 먹은 메뉴 (선택) — 가게 메뉴판에서 고르거나 직접 적기
export function MenuPicker({ initial, options }: { initial: string[]; options: string[] }) {
  const [picked, setPicked] = useState<string[]>(initial);
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const full = picked.length >= MENUS_MAX;
  const choices = [...new Set([...picked, ...options])];
  const shown = showAll ? choices : choices.slice(0, Math.max(8, picked.length));

  function toggle(name: string) {
    setPicked(picked.includes(name) ? picked.filter((m) => m !== name) : full ? picked : [...picked, name]);
  }
  function addTyped() {
    const name = text.trim().slice(0, MENU_NAME_MAX);
    if (name && !picked.includes(name) && !full) setPicked([...picked, name]);
    setText("");
  }

  return (
    <div role="group" aria-labelledby="menus-label" className="flex flex-col gap-2 px-5 pt-6">
      <span id="menus-label" className="text-body font-semibold">
        먹은 메뉴 <span className="text-meta font-normal text-muted">선택</span>
      </span>
      {picked.map((m) => (
        <input key={m} type="hidden" name="menus" value={m} />
      ))}
      {choices.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((m) => {
            const on = picked.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(m)}
                className={`h-9 max-w-full truncate rounded-full px-3 text-meta font-medium disabled:opacity-40 ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
              >
                {m}
              </button>
            );
          })}
          {choices.length > shown.length && (
            <button type="button" onClick={() => setShowAll(true)} className="h-9 px-2 text-meta font-semibold text-ink">
              메뉴 {choices.length - shown.length}개 더 보기
            </button>
          )}
        </div>
      )}
      {!full && (
        <div className="flex gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTyped();
              }
            }}
            maxLength={MENU_NAME_MAX}
            placeholder={options.length ? "메뉴판에 없으면 직접 적기" : "메뉴 이름"}
            aria-label="먹은 메뉴 직접 적기"
            className="h-11 min-w-0 flex-1 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink"
          />
          <button type="button" onClick={addTyped} disabled={!text.trim()} className="h-11 shrink-0 rounded-[12px] bg-surface px-4 text-meta font-semibold text-ink disabled:opacity-40">
            넣기
          </button>
        </div>
      )}
    </div>
  );
}
