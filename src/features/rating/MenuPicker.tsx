"use client";

import { useEffect, useState } from "react";
import { MENU_NAME_MAX, MENUS_MAX } from "./rating";

// 먹은 메뉴 (선택) — 가게 메뉴판에서 고르거나 직접 적기
// 메뉴판은 늦게 올 수 있어(외부 조회) 폼을 막지 않고 도착하면 뒤에 붙인다
export function MenuPicker({ initial, options }: { initial: string[]; options: Promise<string[]> }) {
  const [picked, setPicked] = useState<string[]>(initial);
  // 순서는 한 번 정하면 그대로 — 누를 때 칩이 자리를 옮기지 않게 (직접 적은 메뉴만 앞에)
  const [order, setOrder] = useState<string[]>(initial);
  const [hasMenu, setHasMenu] = useState(false);
  useEffect(() => {
    let live = true;
    options.then((list) => {
      if (!live) return;
      setHasMenu(list.length > 0);
      setOrder((prev) => [...new Set([...prev, ...list])]);
    }, () => {});
    return () => {
      live = false;
    };
  }, [options]);
  const [text, setText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const full = picked.length >= MENUS_MAX;
  const choices = order;
  const shown = showAll ? choices : choices.slice(0, Math.max(8, picked.length));

  function toggle(name: string) {
    setPicked(picked.includes(name) ? picked.filter((m) => m !== name) : full ? picked : [...picked, name]);
  }
  function addTyped() {
    const name = text.trim().slice(0, MENU_NAME_MAX);
    if (name && !picked.includes(name) && !full) {
      setPicked([...picked, name]);
      if (!order.includes(name)) setOrder([name, ...order]);
    }
    setText("");
  }

  return (
    <div role="group" aria-labelledby="menus-label" className="flex flex-col gap-2 px-5 pt-6">
      <span id="menus-label" className="text-body font-semibold">
        먹은 메뉴
      </span>
      {picked.map((m) => (
        <input key={m} type="hidden" name="menus" value={m} />
      ))}
      {choices.length > 0 && (
        <div className="flex flex-wrap gap-x-1.5 gap-y-2">
          {shown.map((m) => {
            const on = picked.includes(m);
            return (
              <button
                key={m}
                type="button"
                aria-pressed={on}
                disabled={!on && full}
                onClick={() => toggle(m)}
                className={`relative h-9 max-w-full truncate rounded-full px-3 text-meta font-medium before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] disabled:opacity-40 ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`}
              >
                {m}
              </button>
            );
          })}
          {choices.length > shown.length && (
            <button type="button" onClick={() => setShowAll(true)} className="h-9 rounded-full px-3 text-meta font-semibold text-ink ring-1 ring-line">
              {choices.length - shown.length}개 더 보기
            </button>
          )}
        </div>
      )}
      {full && <span className="text-caption text-muted">메뉴는 {MENUS_MAX}개까지 고를 수 있어요.</span>}
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
            placeholder={hasMenu ? "메뉴판에 없는 메뉴 적기" : "메뉴 이름"}
            aria-label="먹은 메뉴 직접 적기"
            className="h-11 min-w-0 flex-1 rounded-[12px] bg-surface px-3.5 text-body outline-none focus:bg-white focus:ring-1 focus:ring-ink"
          />
          <button type="button" onClick={addTyped} disabled={!text.trim()} className="h-11 shrink-0 rounded-[12px] bg-ink px-4 text-meta font-semibold text-white disabled:bg-surface disabled:text-muted">
            추가
          </button>
        </div>
      )}
    </div>
  );
}
