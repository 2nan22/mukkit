"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { ImportArt, RateArt, TrustArt } from "./IntroArt";

// 시작하기 화면 소개 3장 — 가져오기 → 내 기준으로 평가 → 믿는 사람의 평가. 옆으로 넘긴다 (자동 넘김 없음)
// 그림은 실제 화면을 본뜬 장식 — 화면 낭독기는 제목 · 설명만 읽는다
const SLIDES = [
  {
    title: "저장해 둔 맛집,\n지도로 꺼내요",
    body: "네이버 지도나 카카오맵 리스트를 링크 하나로 가져와요.",
    art: <ImportArt />,
    tint: "bg-[#eaeee6]",
  },
  {
    title: "별점 대신\n숟가락 3, 2, 1",
    body: "나만 알고 싶은 곳에 3숟가락을 줘요.",
    art: <RateArt />,
    tint: "bg-[#f8ece3]",
  },
  {
    title: "별점 평균 대신\n누가 줬는지",
    body: "아는 사람의 등급만 보여요. 광고는 없어요.",
    art: <TrustArt />,
    tint: "bg-[#eceef3]",
  },
] as const;

const LAST = SLIDES.length - 1;

export function IntroSlides() {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // 넘긴 위치로 지금 몇 번째인지
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.min(LAST, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function go(i: number) {
    const el = track.current;
    if (!el || i < 0 || i > LAST) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: calm ? "auto" : "smooth" });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else return;
    e.preventDefault();
  }

  return (
    <section aria-roledescription="캐러셀" aria-label="서비스 소개" onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 px-6 pt-5 [@media(max-height:700px)]:pt-3">
        <Wordmark size="sm" />
        <span className="text-caption text-muted">아는 사람의 맛집 지도</span>
      </div>
      <div
        ref={track}
        tabIndex={0}
        className="relative flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-inset [&::-webkit-scrollbar]:hidden"
      >
        {SLIDES.map((s, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="슬라이드"
            aria-label={`${SLIDES.length}장 중 ${i + 1}장`}
            className="flex w-full shrink-0 snap-start snap-always flex-col"
          >
            <div className="flex flex-col gap-2 px-6 pt-3 [@media(max-height:700px)]:pt-2">
              {i === 0 ? (
                <h1 className="text-[26px] leading-[1.32] font-bold tracking-[-0.02em] whitespace-pre-line text-ink [@media(max-height:700px)]:text-title">{s.title}</h1>
              ) : (
                <h2 className="text-[26px] leading-[1.32] font-bold tracking-[-0.02em] whitespace-pre-line text-ink [@media(max-height:700px)]:text-title">{s.title}</h2>
              )}
              <p className="text-body leading-normal text-muted">{s.body}</p>
            </div>
            <div aria-hidden="true" className={`relative mx-5 mt-5 min-h-[190px] flex-1 overflow-hidden rounded-[28px] [@media(max-height:700px)]:mt-3 ${s.tint}`}>
              {s.art}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pr-3 pl-4">
        <div role="group" aria-label="소개 장 고르기" className="flex">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`${i + 1}번째 소개 보기`}
              aria-current={index === i ? "true" : undefined}
              className="flex h-11 w-11 items-center justify-center"
            >
              <span className={`block h-1 w-9 rounded-full transition-colors motion-reduce:transition-none ${index === i ? "bg-ink" : "bg-line-strong"}`} />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          className={`flex h-11 items-center gap-0.5 px-2 text-meta font-semibold text-ink ${index === LAST ? "invisible" : ""}`}
        >
          다음
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </section>
  );
}
