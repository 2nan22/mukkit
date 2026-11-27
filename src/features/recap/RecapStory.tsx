"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FoodArt } from "@/components/ui/CuisineIcon";
import { TierIcon } from "@/components/ui/TierIcon";
import { CUISINE_LABEL } from "@/domain/cuisine";
import { TIER_LABEL } from "@/domain/tier";
import { useLeave } from "@/lib/nav/useLeave";
import { RECAP_FULL, type Recap } from "./recap";
import { drawShareImage, saveShareImage, type ShareOptions } from "./shareImage";

type Card = { key: string; bg: string; dark?: boolean; body: ReactNode };

const n = (v: number) => v.toLocaleString("ko-KR");
const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// 순위 목록 한 줄 — 왼쪽 번호(또는 그림) · 이름 · 오른쪽 숫자
function Ranked({ items }: { items: { key: string; lead: ReactNode; name: string; tail: string }[] }) {
  return (
    <ol className="flex flex-col gap-4 pt-3">
      {items.map((it) => (
        <li key={it.key} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3">
          <span className="flex justify-center">{it.lead}</span>
          <span className="truncate text-[20px] font-bold tracking-[-0.02em]">{it.name}</span>
          <span className="text-body text-ink-2 tabular-nums">{it.tail}</span>
        </li>
      ))}
    </ol>
  );
}

const num = (i: number) => <span className="flex size-8 items-center justify-center rounded-full border border-ink/20 text-meta font-bold">{i + 1}</span>;

function cardsOf(r: Recap, summary: ReactNode): Card[] {
  const cards: Card[] = [
    {
      key: "cover",
      bg: "bg-[#17181c]",
      dark: true,
      body: (
        <>
          <p className="text-meta font-bold text-white/70">{r.year} 먹킷 결산</p>
          <p className="text-[30px] leading-snug font-bold tracking-[-0.02em]">
            올해 다닌 곳을
            <br />
            돌아봐요
          </p>
          <p className="text-body text-white/70">카드는 나만 볼 수 있어요</p>
        </>
      ),
    },
  ];
  const max = Math.max(1, ...r.tiers.map((t) => t.count));
  cards.push({
    key: "count",
    bg: "bg-white",
    body: (
      <>
        <p className="text-meta font-bold text-muted">올해 등급을 매긴 곳</p>
        <p className="text-[56px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{n(r.rated)}곳</p>
        <p className="text-body text-ink-2">지도에 저장한 곳은 {n(r.saved)}곳이에요</p>
        <ul className="flex flex-col gap-3 pt-6">
          {r.tiers.map((t) => (
            <li key={t.tier} className="grid grid-cols-[96px_minmax(0,1fr)_40px] items-center gap-2 text-body">
              <span className="flex items-center gap-1.5">
                <TierIcon tier={t.tier} height={14} />
                {TIER_LABEL[t.tier]}
              </span>
              <span className="h-2.5 rounded-full bg-surface">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${(t.count / max) * 100}%` }} />
              </span>
              <span className="text-right text-ink-2 tabular-nums">{n(t.count)}</span>
            </li>
          ))}
        </ul>
      </>
    ),
  });
  if (r.cuisines.length) {
    cards.push({
      key: "cuisine",
      bg: "bg-surface",
      body: (
        <>
          <p className="text-meta font-bold text-muted">가장 많이 찾은 음식 종류</p>
          <Ranked items={r.cuisines.map((c) => ({ key: c.cuisine, lead: <FoodArt cuisine={c.cuisine} size={44} />, name: CUISINE_LABEL[c.cuisine], tail: `${n(c.count)}곳` }))} />
        </>
      ),
    });
  }
  if (!r.full) {
    // 평가가 적으면 여기서 끝 — 더 평가하면 볼 수 있는 것을 알려 준다
    cards.push({
      key: "more",
      bg: "bg-white",
      body: (
        <>
          <p className="text-[26px] leading-snug font-bold tracking-[-0.02em]">
            {RECAP_FULL - r.rated}곳 더 평가하면
            <br />
            동네와 나만의 맛집 순위까지 보여 드려요
          </p>
          {r.unrated > 0 ? (
            <>
              <p className="text-body text-ink-2">평가 전인 곳이 {n(r.unrated)}곳 있어요</p>
              <Link href="/rate" onClick={stop} className="mt-4 flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
                빠르게 평가하기
              </Link>
            </>
          ) : (
            <Link href="/my/stats" onClick={stop} className="mt-4 flex h-12 items-center justify-center rounded-btn-m bg-surface text-body font-semibold text-ink">
              내 기록 통계 보기
            </Link>
          )}
        </>
      ),
    });
    return cards;
  }
  if (r.regions.length) {
    cards.push({
      key: "region",
      bg: "bg-brand-soft",
      body: (
        <>
          <p className="text-meta font-bold text-brand">가장 많이 간 동네</p>
          <Ranked items={r.regions.map((g, i) => ({ key: g.region, lead: num(i), name: g.region, tail: `${n(g.count)}곳` }))} />
        </>
      ),
    });
  }
  if (r.ranking.length) {
    cards.push({
      key: "ranking",
      bg: "bg-[#fde6e8]",
      body: (
        <>
          <p className="flex items-center gap-1.5 text-meta font-bold text-[#b42330]">
            <TierIcon tier="three" height={14} /> 나만의 맛집 순위
          </p>
          <p className="text-body text-ink-2">올해 3숟가락을 준 곳 중 내가 매긴 순서예요</p>
          <ol className="flex flex-col gap-2 pt-3">
            {r.ranking.map((p, i) => (
              <li key={p.placeId} className="grid min-h-14 grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] bg-white px-3">
                <span className="flex justify-center">{num(i)}</span>
                <span className="truncate text-[18px] font-bold tracking-[-0.02em]">{p.name}</span>
                {/* 왼쪽 번호와 내 순위가 다를 때만 (순위를 안 정했거나 지난해 곳이 앞에 있을 때) */}
                <span className="text-meta text-muted">{p.rank === null ? "순위 전" : p.rank !== i ? `내 순위 ${p.rank + 1}위` : ""}</span>
              </li>
            ))}
          </ol>
        </>
      ),
    });
  }
  if (r.companions.length) {
    cards.push({
      key: "people",
      bg: "bg-surface",
      body: (
        <>
          <p className="text-meta font-bold text-muted">함께 가장 많이 간 사람</p>
          <Ranked items={r.companions.map((c, i) => ({ key: `${c.name}-${i}`, lead: num(i), name: c.name, tail: `함께 ${n(c.visits)}번` }))} />
          <p className="pt-2 text-caption text-subtle">함께 방문으로 남긴 기록에서 셌어요</p>
        </>
      ),
    });
  }
  cards.push({ key: "summary", bg: "bg-[#17181c]", dark: true, body: summary });
  return cards;
}

// 마지막 카드 — 공유 이미지 미리보기 · 넣을 것 고르기 · 저장
function Summary({ recap }: { recap: Recap }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [opts, setOpts] = useState<ShareOptions>({ regions: false, people: false });
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hidden = recap.ranking.some((p) => p.isPrivate);

  useEffect(() => {
    let alive = true;
    const c = canvas.current;
    if (!c) return;
    void drawShareImage(c, recap, opts).then(() => {
      if (alive) setPreview(c.toDataURL("image/png"));
    });
    return () => {
      alive = false;
    };
  }, [recap, opts]);

  const toggle = (key: keyof ShareOptions, label: string, has: boolean) =>
    has && (
      <label onClick={stop} className="flex min-h-11 items-center justify-between gap-3 text-body">
        {label}
        <input type="checkbox" checked={opts[key]} onChange={(e) => setOpts((o) => ({ ...o, [key]: e.target.checked }))} className="size-5 accent-brand" />
      </label>
    );

  return (
    <>
      <canvas ref={canvas} className="hidden" aria-hidden="true" />
      <p className="text-meta font-bold text-white/70">한 장으로 저장하기</p>
      <div className="mx-auto w-[46%] max-w-[200px] overflow-hidden rounded-[12px] bg-white/10" style={{ aspectRatio: "9 / 16" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 기기에서 그린 이미지 미리보기 */}
        {preview && <img src={preview} alt="저장할 결산 이미지 미리보기" className="size-full" />}
      </div>
      <div className="flex flex-col pt-1">
        {toggle("regions", "많이 간 동네 넣기", recap.regions.length > 0)}
        {toggle("people", "함께 간 사람 넣기", recap.companions.length > 0)}
      </div>
      {opts.people && <p className="text-caption text-white/60">함께 간 사람의 닉네임이 이미지에 보여요</p>}
      {hidden && <p className="text-caption text-white/60">나만 보기로 매긴 곳은 이미지에 넣지 않아요</p>}
      <button
        type="button"
        disabled={busy || !preview}
        onClick={(e) => {
          e.stopPropagation();
          const c = canvas.current;
          if (!c) return;
          setBusy(true);
          setStatus(null);
          saveShareImage(c, recap.year)
            .then((r) => setStatus(r === "downloaded" ? "이미지를 내려받았어요" : r === "shared" ? "이미지를 보냈어요" : null))
            .catch(() => setStatus("이미지를 만들지 못했어요. 다시 눌러 주세요"))
            .finally(() => setBusy(false));
        }}
        className="mt-2 flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand disabled:opacity-60"
      >
        이미지 저장하기
      </button>
      <p role="status" className="min-h-5 text-center text-meta text-white/80">
        {status}
      </p>
    </>
  );
}

// 넘기는 카드 — 화면 오른쪽을 누르면 다음, 왼쪽 3분의 1은 이전 · 키보드 좌우 화살표
export function RecapStory({ recap }: { recap: Recap }) {
  const cards = cardsOf(recap, <Summary recap={recap} />);
  const [i, setI] = useState(0);
  const leave = useLeave("/my/stats");
  const count = cards.length;
  const go = (d: number) => setI((v) => Math.min(count - 1, Math.max(0, v + d)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setI((v) => Math.min(count - 1, v + 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  const card = cards[i];
  const last = i === count - 1;
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
      <section key={card.key} aria-roledescription="카드" aria-label={`${count}장 중 ${i + 1}장`} aria-live="polite" className={`meet-rise flex flex-1 flex-col justify-center gap-3 px-7 ${last ? "pb-6" : "pb-24"}`}>
        {card.body}
      </section>
      {!last && <p className={`pb-6 text-center text-caption ${card.dark ? "text-white/60" : "text-muted"}`}>화면을 누르면 다음 카드예요</p>}
    </main>
  );
}
