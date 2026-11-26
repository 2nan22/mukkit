"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Media = { url: string; kind: "image" | "video" };

// 평가 사진 줄 — 사진을 누르면 화면 가득 크게 (75). 옆으로 넘기기 · 몇 번째 · 닫기 · 뒤로가기로 닫힘
export function MediaStrip({ media }: { media: Media[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const images = media.filter((m) => m.kind === "image");
  return (
    <>
      <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-1.5 overflow-x-auto px-5">
        {media.map((m, i) =>
          m.kind === "image" ? (
            <button key={i} type="button" aria-label="사진 크게 보기" onClick={() => setOpenAt(images.indexOf(m))} className="aspect-[4/5] w-[78%] shrink-0 snap-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다 */}
              <img src={m.url} alt="" className="size-full rounded-btn-l object-cover" />
            </button>
          ) : (
            <video key={i} src={m.url} controls playsInline preload="metadata" className="aspect-[4/5] w-[78%] shrink-0 snap-start rounded-btn-l bg-black object-cover" />
          ),
        )}
      </div>
      {openAt !== null && <PhotoViewer urls={images.map((m) => m.url)} start={openAt} onClose={() => setOpenAt(null)} />}
    </>
  );
}

function PhotoViewer({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const el = strip.current;
    if (el) el.scrollLeft = el.clientWidth * start;
    dialog.current?.focus();
    // 폰 뒤로가기로 닫히게 — 열 때 기록을 하나 쌓고, 뒤로가기(popstate)면 닫는다
    // 이미 쌓여 있으면(개발 모드 두 번 실행 · 숨었다 다시 보임) 또 쌓지 않는다 (75-2 검토)
    if (!(history.state as { photoViewer?: boolean } | null)?.photoViewer) history.pushState({ ...history.state, photoViewer: true }, "");
    const onPop = () => closeRef.current();
    addEventListener("popstate", onPop);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("popstate", onPop);
      document.body.style.overflow = prevOverflow;
    };
  }, [start]);

  // 닫기 버튼 · Esc 는 쌓은 기록을 되돌려 닫는다 (popstate 가 onClose 를 부름) — 두 번 눌러도 한 번만 (75-2 검토)
  const closing = useRef(false);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    history.back();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사진 크게 보기"
      tabIndex={-1}
      ref={dialog}
      onKeyDown={(e) => e.key === "Escape" && close()}
      className="fixed inset-0 z-[60] flex flex-col bg-black outline-none"
    >
      <div className="flex shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)] text-white [&>*]:my-1.5">
        <button type="button" onClick={close} aria-label="닫기" className="flex size-11 items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        {urls.length > 1 && (
          <span className="pr-4 text-meta tabular-nums" aria-live="polite">
            {index + 1} / {urls.length}
          </span>
        )}
      </div>
      <div
        ref={strip}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain"
      >
        {urls.map((u, i) => (
          <div key={i} className="flex h-full w-full shrink-0 snap-center items-center justify-center pb-[env(safe-area-inset-bottom)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다 */}
            <img src={u} alt={`사진 ${i + 1}`} className="max-h-full max-w-full object-contain" />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
