"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { FoodArt } from "@/components/ui/CuisineIcon";
import { TierIcon } from "@/components/ui/TierIcon";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { TIER_LABEL } from "@/domain/tier";
import { useLeave } from "@/lib/nav/useLeave";
import type { Recap } from "./recap";

type Card = { key: string; bg: string; dark?: boolean; body: ReactNode };

// 받침 있으면 '이에요', 없으면 '예요'
const ieyo = (word: string) => {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? "이에요" : "예요";
};

function cardsOf(r: Recap): Card[] {
  const n = (v: number) => v.toLocaleString("ko-KR");
  const cards: Card[] = [
    {
      key: "cover",
      bg: "bg-[#17181c]",
      dark: true,
      body: (
        <>
          <p className="text-meta font-bold tracking-wide text-white/70">{r.year} 먹킷 결산</p>
          <p className="text-[28px] leading-snug font-medium">
            올해 <b className="font-extrabold">{n(r.rated)}곳</b>에
            <br />
            등급을 매겼어요
          </p>
          <p className="text-body text-white/70">저장한 곳은 {n(r.saved)}곳이에요</p>
        </>
      ),
    },
  ];
  if (r.best) {
    cards.push({
      key: "best",
      bg: "bg-[#fde6e8]",
      body: (
        <>
          <p className="flex items-center gap-1.5 text-meta font-bold text-[#b42330]">
            <TierIcon tier="three" height={14} /> 올해의 3숟가락
          </p>
          <p className="text-[28px] leading-snug font-extrabold break-keep">{r.best.name}</p>
          <p className="text-body text-ink-2">
            {r.best.rank !== null ? `나만의 맛집 순위 ${r.best.rank + 1}위예요` : `올해 3숟가락을 준 ${n(r.best.threeCount)}곳 중 가장 최근이에요`}
          </p>
          <Link href={`/p/${r.best.placeId}`} onClick={(e) => e.stopPropagation()} className="mt-2 flex h-10 w-fit items-center rounded-full bg-white px-4 text-meta font-bold text-ink">
            가게 보기
          </Link>
        </>
      ),
    });
  }
  if (r.cuisine) {
    const label = CUISINE_LABEL[r.cuisine.cuisine];
    cards.push({
      key: "cuisine",
      bg: "bg-surface",
      body: (
        <>
          <FoodArt cuisine={r.cuisine.cuisine} size={88} />
          <p className="pt-2 text-meta font-bold text-muted">가장 많이 평가한 음식</p>
          <p className="text-[28px] leading-snug font-extrabold">
            {label}
            {ieyo(label)}
          </p>
          <p className="text-body text-ink-2">
            평가한 {n(r.rated)}곳 중 {n(r.cuisine.count)}곳이에요
          </p>
        </>
      ),
    });
  }
  if (r.region) {
    cards.push({
      key: "region",
      bg: "bg-brand-soft",
      body: (
        <>
          <p className="text-meta font-bold text-brand">가장 많이 다닌 동네</p>
          <p className="text-[28px] leading-snug font-extrabold">
            {r.region.region}
            {ieyo(r.region.region)}
          </p>
          <p className="text-body text-ink-2">{n(r.region.count)}곳을 평가했어요</p>
        </>
      ),
    });
  }
  const max = Math.max(1, ...r.tiers.map((t) => t.count));
  cards.push({
    key: "tiers",
    bg: "bg-white",
    body: (
      <>
        <p className="text-meta font-bold text-muted">올해 내 등급</p>
        <ul className="flex flex-col gap-3 pt-2">
          {r.tiers.map((t) => (
            <li key={t.tier} className="grid grid-cols-[92px_minmax(0,1fr)_40px] items-center gap-2 text-body">
              <span className="flex items-center gap-1.5">
                <TierIcon tier={t.tier} height={14} />
                {TIER_LABEL[t.tier]}
              </span>
              <span className="h-2.5 rounded-full bg-surface">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(t.count / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums text-ink-2">{n(t.count)}</span>
            </li>
          ))}
        </ul>
        <Link href="/my/stats" onClick={(e) => e.stopPropagation()} className="mt-6 flex h-12 items-center justify-center rounded-btn-m bg-surface text-body font-semibold text-ink">
          내 기록 통계 보기
        </Link>
      </>
    ),
  });
  return cards;
}

// 넘기는 카드 — 화면 오른쪽을 누르면 다음, 왼쪽 3분의 1은 이전 · 키보드 좌우 화살표
export function RecapStory({ recap }: { recap: Recap }) {
  const cards = cardsOf(recap);
  const [i, setI] = useState(0);
  const leave = useLeave("/my/stats");
  const go = (d: number) => setI((v) => Math.min(cards.length - 1, Math.max(0, v + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 카드 수는 화면 동안 그대로
  }, []);

  const card = cards[i];
  return (
    <main
      className={`mx-auto flex min-h-dvh w-full max-w-[480px] flex-col ${card.bg} ${card.dark ? "text-white" : "text-ink"} pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] transition-colors duration-300 select-none`}
      onClick={(e) => go(e.clientX - e.currentTarget.getBoundingClientRect().left < e.currentTarget.clientWidth / 3 ? -1 : 1)}
    >
      <div className="flex gap-1 px-3 pt-3" aria-hidden="true">
        {cards.map((c, k) => (
          <span key={c.key} className={`h-[3px] flex-1 rounded-full ${k <= i ? (card.dark ? "bg-white" : "bg-ink") : card.dark ? "bg-white/30" : "bg-black/10"}`} />
        ))}
      </div>
      <div className="flex h-12 items-center justify-end px-2">
        <button
          type="button"
          aria-label="닫기"
          onClick={(e) => {
            e.stopPropagation();
            leave();
          }}
          className="flex size-11 items-center justify-center"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <section key={card.key} aria-roledescription="카드" aria-label={`${cards.length}장 중 ${i + 1}장`} aria-live="polite" className="meet-rise flex flex-1 flex-col justify-center gap-3 px-7 pb-24">
        {card.body}
      </section>
      <p className={`pb-6 text-center text-caption ${card.dark ? "text-white/60" : "text-muted"}`}>{i < cards.length - 1 ? "화면을 누르면 다음 카드예요" : "이 결산은 나만 볼 수 있어요"}</p>
    </main>
  );
}
