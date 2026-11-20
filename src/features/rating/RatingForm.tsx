"use client";

import { useActionState } from "react";
import { TierBadge } from "@/components/ui/TierBadge";
import { TIER_LABEL, TIER_MEANING, type Tier } from "@/domain/tier";
import { saveRating, type RatingFormState } from "./actions";
import { NOTE_MAX, type SavedPlace } from "./rating";

const RATED: Tier[] = ["three", "two", "one", "notRecommended"];
const NOT_RATED: Tier[] = ["wantToGo", "unrated"];

export function RatingForm({ place, next }: { place: SavedPlace; next: string }) {
  const [state, action, pending] = useActionState<RatingFormState, FormData>(saveRating, {});

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
        <label htmlFor="note" className="text-meta font-bold">
          한 줄 평가
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={NOTE_MAX}
          defaultValue={place.note}
          placeholder="나만 보는 메모예요"
          className="w-full resize-none rounded-btn-m border border-line-strong px-3.5 py-3 text-body leading-normal text-ink outline-none focus:border-ink"
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
          <span className="text-meta text-muted">체크하면 등급 통계에 들어가지 않아요</span>
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
