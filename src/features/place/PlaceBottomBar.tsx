"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveWantToGo, savePlaceToList } from "./actions";

type Props = { placeId: string; saved: boolean; rated: boolean; lists: { id: string; name: string }[] };

export function PlaceBottomBar({ placeId, saved, rated, lists }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string }>, done: string) {
    start(async () => {
      const res = await fn();
      setMessage(res.error ?? done);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-white px-5 pt-3 pb-5">
      {message && (
        <p role="status" className="text-center text-meta text-ink-2">
          {message}
        </p>
      )}
      {open && (
        <ul className="max-h-60 overflow-y-auto rounded-btn-l border border-line">
          {lists.length === 0 && <li className="p-4 text-meta text-muted">아직 만든 리스트가 없어요.</li>}
          {lists.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => savePlaceToList(placeId, l.id), `'${l.name}'에 담았어요`)}
                className="flex min-h-12 w-full items-center border-b border-line px-4 text-left text-body last:border-b-0"
              >
                {l.name}
              </button>
            </li>
          ))}
          <li>
            <Link href={`/lists/new?add=${placeId}`} className="flex min-h-12 items-center px-4 text-meta text-ink-2">
              새 리스트 만들기
            </Link>
          </li>
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="h-btn-l rounded-btn-l bg-surface text-[16px] font-bold text-ink">
          리스트에 담기
        </button>
        {saved ? (
          <Link href={`/rate/${placeId}?next=/p/${placeId}`} className="flex h-btn-l items-center justify-center rounded-btn-l bg-brand text-[16px] font-bold text-white raised-brand">
            {rated ? "평가 수정" : "평가하기"}
          </Link>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => saveWantToGo(placeId), "가고 싶은 곳에 저장했어요")}
            className="h-btn-l rounded-btn-l bg-brand text-[16px] font-bold text-white disabled:opacity-60 raised-brand"
          >
            가고 싶은 곳 저장
          </button>
        )}
      </div>
    </div>
  );
}
