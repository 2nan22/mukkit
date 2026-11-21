"use client";

import { useActionState, useEffect } from "react";
import { useLeave } from "@/lib/nav/useLeave";
import { TierBadge } from "@/components/ui/TierBadge";
import { TIER_LABEL, TIER_MEANING, type Tier } from "@/domain/tier";
import { saveRating, type RatingFormState } from "./actions";
import { NOTE_MAX, RATING_VISIBILITIES, REVIEW_MAX, type RatingVisibility, type SavedPlace } from "./rating";
import { MediaUploader } from "./MediaUploader";

const VISIBILITY_TEXT: Record<RatingVisibility, string> = { private: "나만", followers: "팔로워", public: "전체 공개" };

const RATED: Tier[] = ["three", "two", "one", "notRecommended"];
const NOT_RATED: Tier[] = ["wantToGo", "unrated"];

export function RatingForm({ place, next, userId }: { place: SavedPlace; next: string; userId: string }) {
  const [state, action, pending] = useActionState<RatingFormState, FormData>(saveRating, {});
  const leave = useLeave(next);
  useEffect(() => {
    if (state.saved) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 저장된 순간 한 번만
  }, [state]);

  return (
    <form action={action} className="flex flex-1 flex-col">
      <input type="hidden" name="placeId" value={place.placeId} />
      <input type="hidden" name="next" value={next} />

      <fieldset className="flex flex-col gap-1.5 px-5 pt-2 pb-1">
        <legend className="sr-only">등급</legend>
        {RATED.map((tier) => (
          <label
            key={tier}
            className="flex h-btn-l cursor-pointer items-center gap-3 rounded-btn-l border border-line px-3.5 has-checked:border-[1.5px] has-checked:border-ink"
          >
            <span className="w-16 shrink-0">
              <TierBadge tier={tier} />
            </span>
            <span className="flex-1 text-body">{TIER_MEANING[tier]}</span>
            <input
              type="radio"
              name="tier"
              value={tier}
              defaultChecked={tier === place.tier}
              aria-label={TIER_LABEL[tier]}
              className="size-5 accent-ink"
            />
          </label>
        ))}
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {NOT_RATED.map((tier) => (
            <label
              key={tier}
              className="flex h-btn-m cursor-pointer items-center justify-center gap-2 rounded-btn-m border border-line text-meta text-ink-2 has-checked:border-[1.5px] has-checked:border-ink has-checked:font-bold has-checked:text-ink"
            >
              <input type="radio" name="tier" value={tier} defaultChecked={tier === place.tier} className="sr-only" />
              {tier === "unrated" ? "평가 안 함" : TIER_LABEL[tier]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2 px-5 pt-4">
        <label htmlFor="review" className="text-meta font-bold">
          한 줄 평가
        </label>
        <textarea
          id="review"
          name="review"
          rows={2}
          maxLength={REVIEW_MAX}
          defaultValue={place.review}
          placeholder="한 줄로 남겨 보세요"
          className="w-full resize-none rounded-btn-m border border-line-strong px-3.5 py-3 text-body leading-normal text-ink outline-none focus:border-ink"
        />
      </div>

      <div className="px-5 pt-4">
        <MediaUploader userId={userId} placeId={place.placeId} />
      </div>

      <div role="radiogroup" aria-labelledby="visibility-label" className="flex flex-col gap-2 px-5 pt-5">
        <span id="visibility-label" className="text-meta font-bold">
          평가 공개 범위
        </span>
        <div className="grid grid-cols-3 gap-1 rounded-btn-l bg-surface-2 p-1">
          {RATING_VISIBILITIES.map((v) => (
            <label
              key={v}
              className="flex h-9 cursor-pointer items-center justify-center rounded-btn-s text-meta text-muted has-checked:bg-white has-checked:font-bold has-checked:text-ink has-checked:shadow-float"
            >
              <input type="radio" name="visibility" value={v} defaultChecked={v === place.visibility} className="sr-only" />
              {VISIBILITY_TEXT[v]}
            </label>
          ))}
        </div>
        <span className="text-caption leading-normal text-muted">메모는 공개 범위와 상관없이 나만 볼 수 있어요.</span>
      </div>

      <div className="flex flex-col gap-2 px-5 pt-4">
        <label htmlFor="note" className="text-meta font-bold">
          나만 보는 메모
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          maxLength={NOTE_MAX}
          defaultValue={place.note}
          placeholder="나만 보는 메모"
          className="w-full resize-none rounded-btn-m border border-line-strong bg-surface px-3.5 py-3 text-body leading-normal text-ink outline-none focus:border-ink"
        />
      </div>

      <div className="flex flex-col gap-2 px-5 pt-4">
        <label htmlFor="visitedOn" className="text-meta font-bold">
          방문일
        </label>
        <input
          id="visitedOn"
          name="visitedOn"
          type="date"
          defaultValue={place.visitedOn ?? ""}
          className="h-12 w-full rounded-btn-m border border-line-strong bg-white px-3.5 text-body text-ink outline-none focus:border-ink"
        />
      </div>

      <label className="flex min-h-11 items-start gap-2.5 px-5 pt-4">
        <input
          type="checkbox"
          name="sponsored"
          defaultChecked={place.sponsored}
          className="mt-0.5 size-5 shrink-0 accent-ink"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-body">협찬이나 이벤트로 방문했어요</span>
          <span className="text-meta text-muted">통계에서 빠져요</span>
        </span>
      </label>

      <div className="flex-1" />
      <div className="flex flex-col gap-2 p-5">
        {state.error && (
          <p role="alert" className="text-meta text-[#c4320a]">
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-btn-l rounded-btn-l bg-ink text-[16px] font-bold text-white disabled:opacity-60"
        >
          {pending ? "저장하는 중" : "저장"}
        </button>
      </div>
    </form>
  );
}
