"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderBubble } from "@/components/ui/EatingLoader";

// 페이지를 옮기는 동안 — 링크를 누른 뒤 다음 화면이 올 때까지 가운데에 젓가락 로딩 (0.25초 안에 오면 안 보임)
// 누른 주소를 기억해 두고, 지금 주소가 그와 같아지면 끝난 것 — 뒤로가기 · 코드로 옮기기는 표시하지 않는다
export function NavLoading() {
  const pathname = usePathname();
  const params = useSearchParams();
  const here = pathname + (params.size ? `?${params.toString()}` : "");
  const [target, setTarget] = useState<{ to: string; from: string } | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/auth/")) return;
      const to = url.pathname + url.search;
      const from = window.location.pathname + window.location.search;
      if (to === from) return;
      setTarget({ to, from });
      // 같은 주소로 되돌아오는 리다이렉트 등으로 끝을 못 알아채도 10초 뒤엔 지운다
      window.setTimeout(() => setTarget((t) => (t && t.to === to ? null : t)), 10_000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // 주소가 바뀌었으면(도착 · 다른 곳으로 리다이렉트) 끝 — 상태를 지우지 않아도 화면엔 안 보이게 계산
  const pending = target !== null && target.from === here;
  if (!pending) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center">
      <LoaderBubble label="화면을 불러오는 중" />
    </div>
  );
}
