"use client";

import { useRouter } from "next/navigation";
import { canGoBack } from "./history";
import { askBeforeLeave } from "./leaveGuard";

// 앱 안에서 왔으면 뒤로, 바로 열었으면 상위 화면으로 바꿔 들어간다
// 저장 안 한 고침이 있는 화면이면 먼저 묻는다 (leaveGuard)
export function useLeave(fallback: string) {
  const router = useRouter();
  return () => {
    if (askBeforeLeave()) return;
    if (canGoBack()) router.back();
    else router.replace(fallback);
  };
}
