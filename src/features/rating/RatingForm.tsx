"use client";

import { useActionState, useEffect, useState } from "react";
import { useLeave } from "@/lib/nav/useLeave";
import { TierBadge } from "@/components/ui/TierBadge";
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

const VISIBILITY_TEXT: Record<RatingVisibility, string> = { private: "나만", followers: "팔로워", public: "전체 공개" };

const RATED: Tier[] = ["three", "two", "one", "notRecommended"];
const NOT_RATED: Tier[] = ["wantToGo", "unrated"];

// 고른 등급은 그 등급의 옅은 색으로
const PICKED: Partial<Record<Tier, string>> = {
  three: "has-checked:border-tier-3 has-checked:bg-tier-3-soft",
  two: "has-checked:border-tier-2 has-checked:bg-tier-2-soft",
  one: "has-checked:border-tier-1 has-checked:bg-tier-1-soft",
  notRecommended: "has-checked:border-ink has-checked:bg-surface",
};

export function RatingForm({ place, next, userId, visits, menuOptions }: { place: SavedPlace; next: string; userId: string; visits: MyVisit[]; menuOptions: string[] }) {
  const [state, action, pending] = useActionState<RatingFormState, FormData>(saveRating, {});
  // 안 가본 곳(가고 싶은 곳 · 평가 전)이면 방문 관련 칸을 숨긴다 — 값은 그대로 보낸다
  const [tier, setTier] = useState<Tier>(place.tier);
  const visited = RATED.includes(tier);
  const leave = useLeave(next);
  // 3숟가락으로 저장했고 아직 3숟가락 순위에 없으면 — 같은 3숟가락과 비교해 자리를 정한다 (첫 3숟가락이면 바로 1위)
  const [compare, setCompare] = useState<{ target: RankPlace; ranked: RankPlace[] } | null>(null);
  useEffect(() => {
    if (!state.saved) return;
    if (tier !== "three") return leave();
    (async () => {
      const got = await loadThreeCompare(place.placeId).catch(() => null);
      if (!got?.target || got.alreadyRanked) return leave();
      if (got.ranked.length === 0) {
        await placeInThree(place.placeId, null).catch(() => null);
        return leave();
      }
      setCompare({ target: got.target, ranked: got.ranked });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장된 순간 한 번만
  }, [state]);

  return (
    <>
    {compare && <CompareSheet target={compare.target} ranked={compare.ranked} onDone={() => leave()} />}
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="placeId" value={place.placeId} />
      <input type="hidden" name="next" value={next} />

      <fieldset onChange={(e) => setTier((e.target as unknown as HTMLInputElement).value as Tier)} className="flex flex-col gap-2 px-5 pt-2 pb-1">
        <legend className="sr-only">등급</legend>
        {RATED.map((tier) => (
          <label
            key={tier}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] py-2 border border-line px-3.5 has-checked:border-[1.5px] ${PICKED[tier]}`}
          >
            <span className="w-[84px] shrink-0">
              <TierBadge tier={tier} />
            </span>
            <span className="flex-1 text-meta text-ink-2">{TIER_MEANING[tier]}</span>
            <input
              type="radio"
              name="tier"
              value={tier}
              defaultChecked={tier === place.tier}
              aria-label={TIER_LABEL[tier]}
              className="size-5 accent-brand"
            />
          </label>
        ))}
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {NOT_RATED.map((tier) => (
            <label
              key={tier}
              className="flex h-btn-m cursor-pointer items-center justify-center gap-2 rounded-full bg-surface text-meta font-medium text-ink-2 has-checked:bg-ink has-checked:text-white raised"
            >
              <input type="radio" name="tier" value={tier} defaultChecked={tier === place.tier} className="sr-only" />
              {tier === "unrated" ? "평가 전" : TIER_LABEL[tier]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={`flex flex-col gap-2 px-5 pt-6 ${visited ? "" : "hidden"}`}>
        <label htmlFor="review" className="text-body font-semibold">
          한 줄 평가
        </label>
        <textarea
          id="review"
          name="review"
          rows={2}
          maxLength={REVIEW_MAX}
          defaultValue={place.review}
          placeholder="예: 점심 정식이 좋아요"
          className="w-full resize-none rounded-[12px] border border-transparent bg-surface px-3.5 py-3 text-body leading-normal text-ink outline-none focus:border-ink focus:bg-white"
        />
      </div>

      <div className={visited ? "" : "hidden"}>
        <MenuPicker initial={place.menus} options={menuOptions} />
      </div>

      <div className={`px-5 pt-6 ${visited ? "" : "hidden"}`}>
        <MediaUploader userId={userId} placeId={place.placeId} />
      </div>

      <div role="radiogroup" aria-labelledby="visibility-label" className={`flex flex-col gap-2 px-5 pt-6 ${visited ? "" : "hidden"}`}>
        <span id="visibility-label" className="text-body font-semibold">
          평가 공개 범위
        </span>
        <div className="grid grid-cols-3 gap-1 rounded-btn-l bg-surface p-1">
          {RATING_VISIBILITIES.map((v) => (
            <label
              key={v}
              className="flex h-9 cursor-pointer items-center justify-center rounded-btn-s text-meta text-muted has-checked:bg-white has-checked:font-bold has-checked:text-ink has-checked:shadow-[0_1px_3px_rgb(0_0_0/0.1)]"
            >
              <input type="radio" name="visibility" value={v} defaultChecked={v === place.visibility} className="sr-only" />
              {VISIBILITY_TEXT[v]}
            </label>
          ))}
        </div>
        <span className="text-caption leading-normal text-muted">팔로워 이상으로 공개하면 팔로잉의 홈에 보여요. 메모는 언제나 나만 봐요.</span>
      </div>

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

      <VisitedOn initial={place.visitedOn} hidden={!visited} />

      <div className={visited ? "" : "hidden"}>
        <CompanionPicker visits={visits} />
      </div>

      <label className={`flex min-h-11 items-start gap-2.5 px-5 pt-6 ${visited ? "" : "hidden"}`}>
        <input
          type="checkbox"
          name="sponsored"
          defaultChecked={place.sponsored}
          className="mt-0.5 size-5 shrink-0 accent-brand"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-body">협찬이나 이벤트로 방문했어요</span>
          <span className="text-meta text-muted">협찬 표시가 붙고 등급 통계와 추천에서 빠져요</span>
        </span>
      </label>

      <div className="flex-1" />
      <div className="sticky bottom-0 mt-6 flex flex-col gap-2 border-t border-line bg-white px-5 pt-3 pb-5">
        {state.error && (
          <p role="alert" className="text-meta text-danger">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand"
        >
          {pending ? "저장하는 중" : "저장"}
        </button>
      </div>
    </form>
    </>
  );
}

function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 방문일 — 대부분 오늘 · 어제라 칩으로, 그 밖은 날짜 고르기
function VisitedOn({ initial, hidden }: { initial: string | null; hidden: boolean }) {
  const [value, setValue] = useState(initial ?? "");
  const [picking, setPicking] = useState(Boolean(initial) && initial !== isoDay(0) && initial !== isoDay(-1));
  const chip = (on: boolean) => `h-8 rounded-full px-3 text-meta font-medium ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`;
  return (
    <div role="group" aria-labelledby="visited-label" className={`flex flex-col gap-2 px-5 pt-6 ${hidden ? "hidden" : ""}`}>
      <span id="visited-label" className="text-body font-semibold">
        방문일
      </span>
      <input type="hidden" name="visitedOn" value={value} />
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!picking && value === isoDay(0)} onClick={() => { setPicking(false); setValue(value === isoDay(0) ? "" : isoDay(0)); }} className={chip(!picking && value === isoDay(0))}>
          오늘
        </button>
        <button type="button" aria-pressed={!picking && value === isoDay(-1)} onClick={() => { setPicking(false); setValue(value === isoDay(-1) ? "" : isoDay(-1)); }} className={chip(!picking && value === isoDay(-1))}>
          어제
        </button>
        <button type="button" aria-pressed={picking} onClick={() => setPicking(true)} className={chip(picking)}>
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
