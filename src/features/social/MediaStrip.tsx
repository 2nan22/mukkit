"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ZoomableImage } from "./ZoomableImage";

type Media = { url: string; kind: "image" | "video" };

// 평가 사진 줄 — 사진을 누르면 화면 가득 크게 (75). 옆으로 넘기기 · 몇 번째 · 닫기 · 뒤로가기로 닫힘
export function MediaStrip({ media }: { media: Media[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const images = media.filter((m) => m.kind === "image");
  // 한 장이면 꽉 채운 정사각형, 여러 장이면 다음 장이 살짝 보이게 78% · 4:5 (80 디자인 검토 — 한 장일 때 오른쪽이 비어 보임)
  const size = media.length === 1 ? "aspect-square w-full" : "aspect-[4/5] w-[78%]";
  return (
    <>
      <div className="relative -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-1.5 overflow-x-auto px-5">
        {media.map((m, i) =>
          m.kind === "image" ? (
            <button key={i} type="button" aria-label="사진 크게 보기" onClick={() => setOpenAt(images.indexOf(m))} className={`relative shrink-0 snap-start ${size}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 서명 주소라 next/image 최적화를 쓰지 않는다 */}
              <img src={m.url} alt="" className="size-full rounded-btn-l object-cover" />
              {/* 여러 장이면 몇 번째인지 — 인스타그램처럼 오른쪽 위 (77) */}
              {media.length > 1 && <Count n={i + 1} total={media.length} />}
            </button>
          ) : (
            <div key={i} className={`relative shrink-0 snap-start ${size}`}>
              <video src={m.url} controls playsInline preload="metadata" className="size-full rounded-btn-l bg-black object-cover" />
              {media.length > 1 && <Count n={i + 1} total={media.length} />}
            </div>
          ),
        )}
      </div>
      {openAt !== null && <PhotoViewer urls={images.map((m) => m.url)} start={openAt} onClose={() => setOpenAt(null)} />}
    </>
  );
}

function Count({ n, total }: { n: number; total: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-2.5 right-2.5 rounded-full bg-black/55 px-2 py-0.5 text-caption font-semibold text-white tabular-nums">
      {n}/{total}
    </span>
  );
}

function PhotoViewer({ urls, start, onClose }: { urls: string[]; start: number; onClose: () => void }) {
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  // 확대 중엔 옆으로 넘기기를 막는다 — 한 손가락 끌기는 사진 옮기기 (75-3)
  const [zoomed, setZoomed] = useState(false);
  // 아래로 끄는 만큼 바탕을 옅게 (0 ~ 1) — 놓으면 닫히거나 제자리
  const [fade, setFade] = useState(0);
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
      style={{ backgroundColor: `rgba(0,0,0,${1 - fade * 0.6})` }}
      className="fixed inset-0 z-[60] flex flex-col overscroll-contain outline-none"
    >
      {/* 머리줄을 끌어도 뒤 화면이 따라 움직이지 않게 (77) */}
      <div style={{ touchAction: "none" }} className="flex shrink-0 items-center justify-between px-2 pt-[env(safe-area-inset-top)] text-white [&>*]:my-1.5">
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
        className={`relative flex min-h-0 flex-1 snap-x snap-mandatory overscroll-contain ${zoomed ? "overflow-hidden" : "overflow-x-auto"}`}
      >
        {urls.map((u, i) => (
          <div key={i} className="h-full w-full shrink-0 snap-center pb-[env(safe-area-inset-bottom)]">
            <ZoomableImage src={u} alt={`사진 ${i + 1}`} active={i === index} onZoomed={setZoomed} onDismiss={close} onDrag={setFade} />
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
