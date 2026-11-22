"use client";

import { useEffect, useRef, useState } from "react";
import { SourceMark } from "@/components/brand/BrandLogo";
import { Avatar } from "@/components/ui/Avatar";
import { TierBadge } from "@/components/ui/TierBadge";
import { MapIllustration } from "./MapIllustration";

// 시작하기 화면 소개 3장 — 가져오기 → 등급 매기기 → 믿는 사람 따라가기. 옆으로 넘긴다
// 그림은 실제 화면 부품(출처 로고 · 등급 배지 · 사람 카드)으로 그린 장식 — 화면 낭독기는 제목 · 설명만 읽는다
const SLIDES = [
  {
    title: "저장해 둔 맛집을\n그대로 가져와요",
    body: "리스트 링크 하나면 지도가 바로 채워져요.",
    art: <ImportArt />,
  },
  {
    title: "가 본 곳은\n내 기준으로 매겨요",
    body: "별점 평균 대신, 찾아갈 만한 정도로 매겨요.",
    art: <TierArt />,
  },
  {
    title: "믿을 만한 사람의\n평가를 따라가요",
    body: "누가 어떤 등급을 줬는지 그대로 보여요.",
    art: <TrustArt />,
  },
] as const;

export function IntroSlides() {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // 넘긴 위치로 지금 몇 번째인지
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function go(i: number) {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <section aria-roledescription="소개" aria-label="마이슐랭 소개" className="flex flex-1 flex-col">
      <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SLIDES.map((s, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="장"
            aria-label={`${SLIDES.length}장 중 ${i + 1}장`}
            className="flex w-full shrink-0 snap-start flex-col"
          >
            <div aria-hidden="true">{s.art}</div>
            <div className="flex flex-col gap-2.5 px-6 pt-6">
              {/* 장마다 같은 자리에 — 제목 높이가 넘길 때 흔들리지 않게 */}
              <span aria-hidden={i > 0} className="text-body font-bold tracking-tight">
                마이슐랭
              </span>
              {i === 0 ? (
                <h1 className="text-title leading-snug font-bold tracking-tight whitespace-pre-line">{s.title}</h1>
              ) : (
                <h2 className="text-title leading-snug font-bold tracking-tight whitespace-pre-line">{s.title}</h2>
              )}
              <p className="text-body leading-relaxed text-ink-2">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-start gap-1 px-5 pt-4">
        {SLIDES.map((_, i) => (
          <button key={i} type="button" onClick={() => go(i)} aria-label={`${i + 1}번째 소개 보기`} aria-current={index === i} className="flex size-6 items-center justify-center">
            <span className={`block h-1.5 rounded-full transition-all ${index === i ? "w-4 bg-ink" : "w-1.5 bg-line-strong"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}

// 1장 — 네이버 · 카카오 리스트가 내 지도로
function ImportArt() {
  return (
    <div className="relative h-[300px] overflow-hidden bg-map-land">
      <div className="absolute top-[150px] left-0 h-2 w-full bg-white" />
      <div className="absolute top-0 left-[62%] h-full w-2 bg-white" />
      <div className="absolute top-9 left-6 flex w-[52%] flex-col gap-2">
        {[
          { source: "naver" as const, name: "을지로 노포", count: "24곳" },
          { source: "kakao" as const, name: "주말 브런치", count: "11곳" },
        ].map((l) => (
          <div key={l.name} className="flex items-center gap-2.5 rounded-btn-l bg-white px-3 py-2.5 shadow-float">
            <SourceMark source={l.source} size={22} />
            <span className="flex flex-col">
              <span className="text-meta font-bold text-ink">{l.name}</span>
              <span className="text-caption text-muted">{l.count}</span>
            </span>
          </div>
        ))}
      </div>
      <svg className="absolute top-[110px] left-[60%]" width="70" height="60" viewBox="0 0 70 60" fill="none" stroke="#17181c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6c20 0 40 14 46 40" />
        <path d="M40 40l10 8 8-11" />
      </svg>
      {[
        [70, 210, "3"],
        [150, 240, "2"],
        [250, 200, "3"],
        [300, 250, "1"],
        [205, 265, "2"],
      ].map(([l, t, n]) => (
        <span
          key={`${l}-${t}`}
          className={`absolute flex size-[24px] items-center justify-center rounded-full border-2 border-white text-caption font-bold shadow-float ${
            n === "3" ? "bg-tier-3 text-white" : n === "2" ? "bg-pin-2 text-white" : "bg-pin-1 text-[#3d2800]"
          }`}
          style={{ left: `${(Number(l) / 390) * 100}%`, top: Number(t) }}
        >
          {n}
        </span>
      ))}
    </div>
  );
}

// 2장 — 가게 하나에 내 등급
function TierArt() {
  return (
    <div className="relative flex h-[300px] items-center justify-center overflow-hidden bg-surface px-8">
      <div className="flex w-full max-w-[300px] flex-col gap-3 rounded-[18px] bg-white p-4 shadow-float">
        <span className="flex flex-col">
          <span className="text-body font-bold text-ink">영남 순대국</span>
          <span className="text-caption text-muted">순대국 · 서울 중구</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          <span className="flex h-8 items-center rounded-full bg-ink px-3 text-meta font-bold text-white">3스타</span>
          <span className="flex h-8 items-center rounded-full bg-surface px-3 text-meta text-ink-2">2스타</span>
          <span className="flex h-8 items-center rounded-full bg-surface px-3 text-meta text-ink-2">1스타</span>
          <span className="flex h-8 items-center rounded-full bg-surface px-3 text-meta text-ink-2">추천 안 함</span>
        </div>
        <span className="text-caption text-muted">일부러 멀리 찾아갈 만한 곳</span>
      </div>
      <div className="absolute right-6 bottom-7 flex items-center gap-2 rounded-full bg-white py-1.5 pr-3 pl-1.5 shadow-float">
        <Avatar name="민지" size={24} />
        <TierBadge tier="three" />
      </div>
    </div>
  );
}

// 3장 — 믿는 사람의 지도 (평균 점수 없이 사람 · 등급)
function TrustArt() {
  return (
    <div className="relative">
      <MapIllustration />
      <div className="absolute top-4 right-4 flex items-center gap-2.5 rounded-btn-l bg-white px-3 py-2.5 shadow-float">
        <Avatar name="민지" size={32} />
        <span className="flex flex-col">
          <span className="text-meta font-bold text-ink">민지</span>
          <span className="text-caption text-muted">3스타 비율 18% · 협찬 0건</span>
        </span>
      </div>
    </div>
  );
}
