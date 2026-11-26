"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { Reaction } from "@/features/reactions/reactions";
import { loadMoreFeed } from "./actions";
import { FeedDivider } from "./FeedDivider";
import { dividerIndex } from "./feedSeen";
import { RatingCard } from "./RatingCard";
import type { FeedCursor, SharedRating } from "./social";

type Item = { rating: SharedRating; reaction: Reaction | null };

const cursorOf = (r: SharedRating): FeedCursor => ({ ratedAt: r.ratedAt, ownerId: r.ownerId, placeId: r.placeId });

// 피드 더 보기 (70) — 맨 아래에 닿으면 20개씩 이어 받는다. 서버가 그린 첫 쪽 뒤에 붙는다
// shown: 서버가 그린 첫 쪽 카드 — 새로 고침(차단 · 댓글)으로 첫 쪽이 당겨 올라와도 두 번 그리지 않는다
// 첫 쪽이 바뀌면 부르는 쪽이 key 로 이 목록을 처음부터 다시 받게 한다
// seenAt: 첫 쪽이 모두 새 평가라 구분선을 못 그렸을 때만 — 더 받은 목록 안에서 그린다 (70-3)
export function FeedMore({ first, shown, seenAt, viewerId, pageSize }: { first: FeedCursor | null; shown: string[]; seenAt: string | null; viewerId: string; pageSize: number }) {
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(first);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // 불러오는 중 표시는 ref 로 — 지켜보는 콜백이 옛 화면 값을 들고 있어도 두 번 부르지 않게
  const loading = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!cursor || loading.current) return;
    loading.current = true;
    setPending(true);
    setError(null);
    try {
      const res = await loadMoreFeed(cursor);
      if (res.error || !res.items) return setError(res.error ?? "불러오지 못했어요.");
      setItems((prev) => [...prev, ...res.items!]);
      const last = res.items.at(-1)?.rating;
      setCursor(res.items.length < pageSize || !last ? null : cursorOf(last));
    } catch {
      setError("불러오지 못했어요.");
    } finally {
      loading.current = false;
      setPending(false);
    }
  };

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !cursor || error || pending) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void load(), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 다 받은 뒤 다시 지켜본다(아직 보이면 곧바로 다음 쪽)
  }, [cursor, error, pending]);

  const seen = new Set(shown);
  const visible = items.filter(({ rating }) => !seen.has(`${rating.ownerId}:${rating.placeId}`));
  const divider = dividerIndex(visible.map((v) => v.rating), seenAt);
  return (
    <>
      {visible.map(({ rating, reaction }, i) => (
        <Fragment key={`${rating.ownerId}:${rating.placeId}`}>
          {i === divider && <FeedDivider none={false} />}
          <RatingCard rating={rating} showOwner viewerId={viewerId} reaction={reaction} />
        </Fragment>
      ))}
      <div ref={sentinel} aria-live="polite" className="flex min-h-14 items-center justify-center text-meta text-muted">
        {error ? (
          <span className="flex flex-col items-center gap-2">
            {error}
            {!error.includes("로그인") && (
              <button type="button" onClick={() => void load()} className="h-10 rounded-full bg-surface px-4 font-semibold text-ink">
                다시 불러오기
              </button>
            )}
          </span>
        ) : cursor ? (
          pending && "불러오는 중"
        ) : (
          first && "더 이전 평가는 없어요"
        )}
      </div>
    </>
  );
}
