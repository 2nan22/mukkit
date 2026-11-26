"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { courseKey } from "@/domain/course";
import { setMeetupCourse } from "./actions";

const SAVE_AFTER_MS = 600;

// 코스 고치기 (84) — 누르면 바로 바꿔 보이고, 연달아 누르면 0.6초 모아 마지막 상태만 저장
// 서버 값은 순서 문자열로 맞춰 보고, 고치는 중(저장 전 · 저장 중)엔 덮지 않는다. 실패 · 남이 먼저 바꿈이면 서버 값으로
export function useCourseDraft(meetupId: string, serverIds: string[]) {
  const router = useRouter();
  const serverKey = courseKey(serverIds);
  const [ids, setIds] = useState(serverIds);
  const [dirty, setDirty] = useState(false);
  const [seenKey, setSeenKey] = useState(serverKey);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();
  if (seenKey !== serverKey) {
    setSeenKey(serverKey);
    if (!dirty && !saving) setIds(serverIds);
  }
  // 저장 때 '이 순서를 보고 고쳤어요'로 보낼 값 · 실패하면 돌아갈 값
  const base = useRef({ key: serverKey, ids: serverIds });
  useEffect(() => {
    if (!dirty && !saving) base.current = { key: serverKey, ids: serverIds };
  }, [serverKey, serverIds, dirty, saving]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function change(next: string[]) {
    setIds(next);
    setDirty(true);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      start(async () => {
        const res = await setMeetupCourse({ meetupId, placeIds: next, expected: base.current.key });
        if (res.error) {
          setError(res.error);
          setIds(base.current.ids);
          router.refresh();
        } else {
          base.current = { key: courseKey(next), ids: next };
        }
        setDirty(false);
      });
    }, SAVE_AFTER_MS);
  }

  return { ids, change, busy: dirty || saving, error, synced: courseKey(ids) === serverKey };
}
