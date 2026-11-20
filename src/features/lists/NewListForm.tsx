"use client";

import { useActionState, useState } from "react";
import { createListWithPlaces, type ListFormState } from "./actions";
import { LIST_NAME_MAX } from "./lists";
import { PlacePicker } from "./PlacePicker";
import type { PickablePlace } from "./pickablePlaces";

export function NewListForm({ places, initialOrigin, initialName }: { places: PickablePlace[]; initialOrigin?: string; initialName?: string }) {
  const [state, action, pending] = useActionState<ListFormState, FormData>(createListWithPlaces, {});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <form action={action} className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-2 px-5 pb-3">
        <label htmlFor="name" className="text-meta font-bold">
          리스트 이름
        </label>
        <input
          id="name"
          name="name"
          defaultValue={initialName}
          maxLength={LIST_NAME_MAX}
          required
          placeholder="예: 을지로 점심, 비 오는 날"
          className="h-12 rounded-btn-m border border-line-strong px-3.5 text-body outline-none focus:border-ink"
        />
        <input type="hidden" name="description" value="" />
      </div>
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="placeId" value={id} />
      ))}
      <PlacePicker places={places} selected={selected} onChange={setSelected} initialOrigin={initialOrigin} />
      <div className="flex flex-col gap-2 border-t border-line px-5 pt-3 pb-5">
        {state.error && (
          <p role="alert" className="text-meta text-[#c4320a]">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="h-btn-l rounded-btn-l bg-ink text-[16px] font-bold text-white disabled:opacity-60">
          {pending ? "만드는 중" : selected.size > 0 ? `${selected.size}곳으로 만들기` : "빈 리스트로 만들기"}
        </button>
      </div>
    </form>
  );
}
