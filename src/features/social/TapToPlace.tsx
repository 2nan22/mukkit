"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

// 평가 카드 빈 곳을 누르면 장소 상세 (73) — 피드 앱 관례. 버튼 · 링크 · 사진 · 영상과 글 고르기는 그대로
// 키보드 · 화면 읽기는 카드 안 가게 이름 링크로 간다 (같은 곳)
const OWN_TAP = "a, button, input, textarea, select, label, video, img, [role=button], [role=dialog], [data-no-tap]";

export function TapToPlace({ placeId, className, children }: { placeId: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  function onClick(e: MouseEvent<HTMLElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if ((e.target as Element).closest(OWN_TAP)) return;
    // 시트 · 메뉴처럼 카드 밖으로 그려진 것(포털)은 카드 누르기가 아니다
    if (!e.currentTarget.contains(e.target as Node)) return;
    if (window.getSelection()?.toString()) return;
    router.push(`/p/${placeId}`);
  }
  return (
    <article onClick={onClick} className={`cursor-pointer transition-colors active:bg-surface ${className ?? ""}`}>
      {children}
    </article>
  );
}
