"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { useLeave } from "@/lib/nav/useLeave";
import { TierBadge } from "@/components/ui/TierBadge";
import { TierIcon } from "@/components/ui/TierIcon";
import { TIER_LABEL, TIER_MEANING, type Tier } from "@/domain/tier";
import { saveRating, type RatingFormState } from "./actions";
import { NOTE_MAX, RATING_VISIBILITIES, REVIEW_MAX, type RatingVisibility, type SavedPlace } from "./rating";
import { MediaUploader } from "./MediaUploader";
import { MenuPicker } from "./MenuPicker";
import { CompanionPicker } from "@/features/visit/CompanionPicker";
import type { MyVisit } from "@/features/visit/visit";
import { loadThreeCompare, placeInThree } from "@/features/rank/actions";
import { CompareSheet } from "@/features/rank/CompareSheet";
import type { RankPlace } from "@/features/rank/rank";
import { CUISINE_LABEL } from "@/domain/cuisine";

const VISIBILITY: Record<RatingVisibility, { label: string; seen: string; desc: string }> = {
  private: { label: "나만", seen: "나만 봐요", desc: "등급 · 한 줄 평가 · 사진 모두 나만" },
  followers: { label: "팔로워", seen: "팔로워에게 보여요", desc: "나를 팔로우하는 사람 피드에" },
  public: { label: "전체 공개", seen: "모두에게 보여요", desc: "프로필 · 공유 리스트에서 누구나" },
};
// 새로 평가할 때 공개 범위는 지난번 고른 값으로 — 한 번 정하면 잘 바꾸지 않는다 (67-2)
const LAST_VISIBILITY = "mk_rating_visibility";
const noSubscribe = () => () => undefined;
function readLastVisibility(): RatingVisibility | null {
  try {
    const v = localStorage.getItem(LAST_VISIBILITY);
    return v && (RATING_VISIBILITIES as readonly string[]).includes(v) ? (v as RatingVisibility) : null;
  } catch {
    return null;
  }
}

const RATED: Tier[] = ["three", "two", "one", "notRecommended"];

type Step = "tier" | "record";

// 평가 (67-2, 시안 2판) — ① 어땠어요? 등급을 누르면 바로 ② 기록. 기록은 고르기 쉬운 것부터, 모두 선택
// 하나의 form 이라 단계와 상관없이 모든 칸을 함께 보낸다 — 단계는 보이는 것만 바꾼다
export function RatingForm({ place, next, userId, visits, menuOptions }: { place: SavedPlace; next: string; userId: string; visits: MyVisit[]; menuOptions: Promise<string[]> }) {
  const [state, action, pending] = useActionState<RatingFormState, FormData>(saveRating, {});
  const rated = RATED.includes(place.tier);
  const [tier, setTier] = useState<Tier>(place.tier);
  // 이미 평가한 곳은 바로 기록으로
  const [step, setStep] = useState<Step>(rated ? "record" : "tier");
  // 고르기 전에는 — 처음 평가하는 곳이면 지난번 값, 아니면 저장된 값
  const last = useSyncExternalStore(noSubscribe, readLastVisibility, () => null);
  const [chosen, setVisibility] = useState<RatingVisibility | null>(null);
  const visibility = chosen ?? (rated ? place.visibility : (last ?? place.visibility));
  const [visOpen, setVisOpen] = useState(false);
  const [sponsored, setSponsored] = useState(place.sponsored);
  const [review, setReview] = useState(place.review);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const leave = useLeave(next);

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [step]);

  // 3숟가락으로 저장했고 아직 3숟가락 순위에 없으면 — 같은 3숟가락과 비교해 자리를 정한다 (첫 3숟가락이면 바로 1위)
  const [compare, setCompare] = useState<ReturnType<typeof compareScope> | null>(null);
  useEffect(() => {
    if (!state.saved) return;
    try {
      localStorage.setItem(LAST_VISIBILITY, visibility);
    } catch {
      // 기억 못 해도 저장은 끝남
    }
    if (tier !== "three") return leave();
    (async () => {
      const got = await loadThreeCompare(place.placeId).catch(() => null);
      if (!got?.target || got.alreadyRanked) return leave();
      if (got.ranked.length === 0) {
        await placeInThree(place.placeId, null).catch(() => null);
        return leave();
      }
      setCompare(compareScope(got.target, got.ranked));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장된 순간 한 번만
  }, [state]);

  function pickTier(t: Tier) {
    setTier(t);
    setStep("record");
  }
  // 가고 싶은 곳은 기록할 게 없어 바로 저장
  function saveWantToGo() {
    // 숨은 등급 칸에 값이 들어간 뒤 보내야 한다
    flushSync(() => setTier("wantToGo"));
    form.current?.requestSubmit();
  }

  return (
    <>
      {compare && <CompareSheet target={compare.target} ranked={compare.ranked} afterOf={compare.afterOf} scope={compare.scope} onDone={() => leave()} />}
      <form ref={form} action={action} className="flex flex-1 flex-col">
        <input type="hidden" name="placeId" value={place.placeId} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="tier" value={tier} />
        <input type="hidden" name="visibility" value={visibility} />

        {step === "tier" && (
          <section className="meet-rise flex flex-1 flex-col px-5 pt-2">
            <h2 ref={heading} tabIndex={-1} className="pb-4 text-[22px] font-bold tracking-tight outline-none">
              어땠어요?
            </h2>
            <div className="flex flex-col gap-2">
              {RATED.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tier === t}
                  onClick={() => pickTier(t)}
                  className={`flex min-h-14 items-center gap-3 rounded-[14px] border px-3.5 py-2 text-left ${tier === t ? "border-[1.5px] border-ink" : "border-line"}`}
                >
                  <span className="w-[92px] shrink-0">
                    <TierBadge tier={t} />
                  </span>
                  <span className="flex-1 text-meta text-ink-2">{TIER_MEANING[t]}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 border-t border-line pt-2">
              <button type="button" disabled={pending} onClick={saveWantToGo} className="flex min-h-12 w-full items-center justify-between text-body">
                <span className="text-ink-2">아직 안 가 봤어요</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap font-semibold">
                  <TierIcon tier="wantToGo" height={13} color="currentColor" />
                  가고 싶은 곳으로
                </span>
              </button>
            </div>
            <div className="flex-1" />
            <button type="button" onClick={leave} className="h-12 text-meta text-muted">
              나중에 할게요
            </button>
          </section>
        )}

        <div className={step === "record" ? "meet-rise flex flex-1 flex-col" : "hidden"}>
          <div className="flex items-center justify-between gap-3 px-5 pt-1">
            <h2 ref={step === "record" ? heading : undefined} tabIndex={-1} className="sr-only">
              {TIER_LABEL[tier]} 기록
            </h2>
            <button type="button" onClick={() => setStep("tier")} aria-label={`등급 바꾸기, 지금 ${TIER_LABEL[tier]}`} className="flex h-10 items-center gap-2 rounded-full border border-line-strong pr-3.5 pl-1.5 text-meta font-semibold">
              <TierBadge tier={tier} />
              바꾸기
            </button>
            <span className="text-meta text-muted">안 써도 저장돼요</span>
          </div>

          <MenuPicker initial={place.menus} options={menuOptions} />

          <div className="px-5 pt-6">
            <MediaUploader userId={userId} placeId={place.placeId} />
          </div>

          <div className="flex flex-col gap-2 px-5 pt-6">
            <label htmlFor="review" className="text-body font-semibold">
              한 줄 평가
            </label>
            <textarea
              id="review"
              name="review"
              rows={2}
              maxLength={REVIEW_MAX}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="예: 점심 정식이 좋아요"
              className="w-full resize-none rounded-[12px] border border-transparent bg-surface px-3.5 py-3 text-body leading-normal text-ink outline-none focus:border-ink focus:bg-white"
            />
          </div>

          <CompanionPicker visits={visits} />

          <VisitedOn initial={place.visitedOn} />

          <div className="flex flex-col gap-2 px-5 pt-6">
            <label htmlFor="note" className="flex items-center gap-1.5 text-body font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-muted" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              나만 보는 메모
            </label>
            <textarea
              id="note"
              name="note"
              rows={2}
              maxLength={NOTE_MAX}
              defaultValue={place.note}
              placeholder="다음에 갈 때 참고할 것"
              className="w-full resize-none rounded-[12px] border border-transparent bg-surface px-3.5 py-3 text-body leading-normal text-ink outline-none focus:border-ink focus:bg-white"
            />
          </div>

          <div className="flex flex-col gap-2 px-5 pt-6">
            <label className="flex min-h-11 items-center gap-2.5">
              <input type="checkbox" name="sponsored" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} className="size-5 shrink-0 accent-ink" />
              <span className="text-body">협찬 · 이벤트로 방문했어요</span>
            </label>
            {sponsored && (
              // 켜면 그 자리에서 어떻게 보이는지 (공정위 '첫 부분 표시' · 캐치테이블 신뢰도 표시)
              <div className="flex flex-col gap-1 rounded-[12px] bg-surface px-3.5 py-3">
                <span className="text-caption text-muted">이렇게 보여요</span>
                <span className="text-body leading-normal">
                  <span className="mr-1.5 inline-flex h-5 items-center rounded border border-line-strong px-1.5 align-[1px] text-caption font-semibold text-muted">협찬</span>
                  {review.trim() || "한 줄 평가"}
                </span>
                <span className="text-caption text-muted">등급 통계 · 추천에서 빠져요</span>
              </div>
            )}
          </div>

          <div className="flex-1" />
          <div className="sticky bottom-0 mt-6 flex flex-col gap-1 border-t border-line bg-white px-5 pt-2 pb-5">
            {state.error && (
              <p role="alert" className="text-meta text-danger">
                {state.error}
              </p>
            )}
            <button type="button" onClick={() => setVisOpen(true)} aria-label={`공개 범위 바꾸기, 지금 ${VISIBILITY[visibility].seen}`} className="flex h-10 items-center justify-center gap-1.5 text-meta text-ink-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {VISIBILITY[visibility].seen}
              <span className="text-muted underline underline-offset-[3px]">바꾸기</span>
            </button>
            <button type="submit" disabled={pending} className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand">
              {pending ? "저장하는 중" : "저장"}
            </button>
          </div>
        </div>
      </form>
      {visOpen && <VisibilitySheet value={visibility} onPick={(v) => (setVisibility(v), setVisOpen(false))} onClose={() => setVisOpen(false)} />}
    </>
  );
}

// 3숟가락 비교 범위 (67-2, Beli 업종별 순위 · '다른 종류를 비교하게 한다'는 불만) — 같은 업종 3숟가락이 있으면 그 안에서만 비교하고,
// 정한 자리는 전체 순위에서 '그 같은 업종 가게 바로 아래(1등이면 그 가게 바로 위)'로 넣는다
export function compareScope(target: RankPlace, ranked: RankPlace[]) {
  const same = ranked.filter((p) => p.cuisine === target.cuisine);
  if (same.length === 0) return { target, ranked, afterOf: undefined, scope: undefined };
  const afterOf = (pos: number): string | null => {
    if (pos > 0) return same[pos - 1].placeId;
    // 같은 업종 1등보다 좋으면 — 전체 순위에서 그 가게 바로 위
    const at = ranked.findIndex((p) => p.placeId === same[0].placeId);
    return at > 0 ? ranked[at - 1].placeId : null;
  };
  return { target, ranked: same, afterOf, scope: `${CUISINE_LABEL[target.cuisine]} 3숟가락끼리 비교해요` };
}

// 누가 볼 수 있어요? — 저장 버튼 위 한 줄에서 여는 시트
function VisibilitySheet({ value, onPick, onClose }: { value: RatingVisibility; onPick: (v: RatingVisibility) => void; onClose: () => void }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => sheet.current?.focus(), []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45" onClick={onClose}>
      <section
        ref={sheet}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vis-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="flex w-full max-w-[480px] flex-col gap-2 rounded-t-[20px] bg-white px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none"
      >
        <span aria-hidden="true" className="mx-auto block h-1 w-9 rounded-full bg-line-strong" />
        <h2 id="vis-title" className="pt-2 text-section font-bold">
          누가 볼 수 있어요?
        </h2>
        <p className="text-meta text-muted">메모는 언제나 나만 봐요</p>
        <div role="radiogroup" aria-labelledby="vis-title" className="flex flex-col gap-1.5 pt-1">
          {RATING_VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              onClick={() => onPick(v)}
              className={`flex min-h-14 items-center justify-between gap-3 rounded-[12px] border px-4 text-left ${value === v ? "border-[1.5px] border-ink" : "border-line"}`}
            >
              <span className="flex flex-col">
                <span className="text-body font-semibold">{VISIBILITY[v].label}</span>
                <span className="text-meta text-muted">{VISIBILITY[v].desc}</span>
              </span>
              <span aria-hidden="true" className={`size-5 shrink-0 rounded-full ${value === v ? "border-[6px] border-ink" : "border-[1.5px] border-line-strong"}`} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 방문일 — 오늘 · 어제 · 날짜 선택 세 칸을 같은 폭으로 (칩 줄 맞춤 규칙, 67)
function VisitedOn({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "");
  const [picking, setPicking] = useState(Boolean(initial) && initial !== isoDay(0) && initial !== isoDay(-1));
  const cell = (on: boolean) => `h-10 rounded-[10px] text-meta font-semibold ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`;
  return (
    <div role="group" aria-labelledby="visited-label" className="flex flex-col gap-2 px-5 pt-6">
      <span id="visited-label" className="text-body font-semibold">
        방문일
      </span>
      <input type="hidden" name="visitedOn" value={value} />
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" aria-pressed={!picking && value === isoDay(0)} onClick={() => { setPicking(false); setValue(value === isoDay(0) ? "" : isoDay(0)); }} className={cell(!picking && value === isoDay(0))}>
          오늘
        </button>
        <button type="button" aria-pressed={!picking && value === isoDay(-1)} onClick={() => { setPicking(false); setValue(value === isoDay(-1) ? "" : isoDay(-1)); }} className={cell(!picking && value === isoDay(-1))}>
          어제
        </button>
        <button type="button" aria-pressed={picking} onClick={() => setPicking(true)} className={cell(picking)}>
          날짜 선택
        </button>
      </div>
      {picking && (
        <input
          type="date"
          aria-label="방문일 선택"
          value={value}
          max={isoDay(0)}
          onChange={(e) => setValue(e.target.value)}
          className="h-12 w-full rounded-[12px] border border-transparent bg-surface px-3.5 text-body text-ink outline-none focus:border-ink"
        />
      )}
    </div>
  );
}
