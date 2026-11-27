"use client";

import { useEffect, useRef } from "react";

// 저장 안 한 고침이 있는 화면에서 나가기 전에 묻는다 (93, 코스 화면)
// - 앱 머리 뒤로 · 닫기(useLeave)는 여기 등록된 물음을 먼저 부른다
// - 폰 뒤로가기는 기록을 하나 쌓아 두고 popstate 로 잡는다
// - 쌓았는지는 모듈 값으로 기억한다 — Next 가 갱신(revalidate) 때 history.state 를 바꿔 써 표시가 지워지므로 (93 검토)
// - 하단 탭 등 링크로 나가는 길 · iOS 탭 닫기(beforeunload 무시)는 묻지 않는다
let ask: (() => void) | null = null;
let wanted = false; // 지금 막아야 하나
let pushed = false; // 우리가 쌓은 기록이 맨 위에 있나
let dropping = false; // 쌓은 기록을 걷는 중 (그 popstate 는 물음이 아님)
let afterLeave: (() => void) | null = null; // '나가기' — 기록을 걷은 뒤 할 일
let listening = false;

function push() {
  history.pushState(history.state, "");
  pushed = true;
}

function onPop() {
  if (dropping) {
    dropping = false;
    pushed = false;
    const go = afterLeave;
    afterLeave = null;
    if (go) go();
    else if (wanted) push(); // 걷는 사이 다시 고치기 시작했으면 다시 쌓는다
    return;
  }
  if (wanted && pushed) {
    // 폰 뒤로가기 — 기록을 다시 쌓고 묻는다
    pushed = false;
    push();
    ask?.();
  }
}

function drop() {
  if (!pushed || dropping) return;
  dropping = true;
  history.back();
}

// useLeave 가 부른다 — 물음을 띄웠으면 true (나가지 않음)
export function askBeforeLeave(): boolean {
  if (!wanted || !ask) return false;
  ask();
  return true;
}

export function useLeaveGuard(active: boolean, onAsk: () => void): { leave: (go: () => void) => void } {
  const onAskRef = useRef(onAsk);
  useEffect(() => {
    onAskRef.current = onAsk;
  });
  // 화면이 사라질 때(링크로 다른 화면) — 기록을 걷으면 새 화면에서 되돌아가 버리므로 표시만 지운다
  // (정리 함수는 선언 순서대로 돌아 아래 효과보다 먼저 알 수 있다)
  const unmounting = useRef(false);
  useEffect(() => {
    unmounting.current = false;
    return () => {
      unmounting.current = true;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    if (!listening) {
      addEventListener("popstate", onPop);
      listening = true;
    }
    wanted = true;
    ask = () => onAskRef.current();
    if (!pushed && !dropping) push();
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", onUnload);
    return () => {
      removeEventListener("beforeunload", onUnload);
      wanted = false;
      ask = null;
      // 저장 · 되돌리기로 고침이 없어지면 쌓은 기록을 걷는다 — 뒤로가기를 두 번 누르지 않게
      if (unmounting.current) {
        if (!afterLeave) pushed = false;
      } else drop();
    };
  }, [active]);

  return {
    // 물음에서 '나가기' — 쌓은 기록을 걷은 뒤 원래 나가기
    leave: (go) => {
      wanted = false;
      ask = null;
      if (pushed || dropping) {
        afterLeave = go;
        drop();
      } else go();
    },
  };
}
