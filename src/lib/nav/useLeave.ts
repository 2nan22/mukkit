"use client";

import { useRouter } from "next/navigation";
import { canGoBack } from "./history";

// 앱 안에서 왔으면 뒤로, 바로 열었으면 상위 화면으로 바꿔 들어간다
export function useLeave(fallback: string) {
  const router = useRouter();
  return () => (canGoBack() ? router.back() : router.replace(fallback));
}
