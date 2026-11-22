"use client";

import { useEffect } from "react";
import { markNotificationsRead } from "./actions";

// 알림함이 화면에 뜨면 다 읽음 — 이번 화면에는 안 읽음 표시가 그대로 남는다
export function MarkRead() {
  useEffect(() => {
    void markNotificationsRead();
  }, []);
  return null;
}
