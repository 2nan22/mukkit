"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { recordPath, restartAt } from "./history";

// 외부 로그인 콜백은 도착 주소에 from=auth 를 붙인다 — 그 화면부터 앱 기록을 새로 시작하고 표시는 주소에서 지운다
export const FROM_AUTH = "auth";

export function NavTracker() {
  const pathname = usePathname();
  const from = useSearchParams().get("from");
  useEffect(() => {
    if (from !== FROM_AUTH) return recordPath(pathname);
    restartAt(pathname);
    const url = new URL(window.location.href);
    url.searchParams.delete("from");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [pathname, from]);
  return null;
}
