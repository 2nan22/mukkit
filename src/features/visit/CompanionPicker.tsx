"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { honor } from "@/domain/honor";
import { findInvitees, type InviteCandidate } from "@/features/meetup/actions";
import { MAX_COMPANIONS, type MyVisit } from "./visit";

type Picked = { userId: string | null; nickname: string; status: "invited" | "accepted" | "declined" | "new" };

const STATUS_TEXT: Record<Picked["status"], string> = { new: "저장하면 요청을 보내요", invited: "수락을 기다려요", accepted: "", declined: "같이 안 갔다고 답했어요" };

// 평가 화면의 '함께 간 사람' — 내가 만든 방문은 고르고, 남이 나를 태그한 방문은 보기 · 피드 허용만
export function CompanionPicker({ visits }: { visits: MyVisit[] }) {
  const mine = visits.find((v) => v.isCreator);
  const others = visits.filter((v) => !v.isCreator);
  const [picked, setPicked] = useState<Picked[]>(() => (mine?.members ?? []).map((m) => ({ userId: m.userId, nickname: m.nickname, status: m.guest ? "accepted" : m.status })));
  const [showInFeed, setShowInFeed] = useState(mine?.myShowInFeed ?? true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InviteCandidate[]>([]);
  const [searching, startSearch] = useTransition();
  const panel = useRef<HTMLDivElement>(null);

  // 폼 맨 아래라 키보드 · 저장 바에 가리지 않게
  useEffect(() => {
    if (adding) panel.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [adding]);

  useEffect(() => {
    if (!adding) return;
    const t = setTimeout(() => startSearch(async () => setResults(await findInvitees(query))), query ? 250 : 0);
    return () => clearTimeout(t);
  }, [adding, query]);

  const full = picked.length >= MAX_COMPANIONS;
  const value = JSON.stringify({
    userIds: picked.flatMap((p) => (p.userId ? [p.userId] : [])),
    guests: picked.flatMap((p) => (p.userId ? [] : [p.nickname])),
    showInFeed,
  });
  const name = query.trim().slice(0, 20);

  function add(p: Picked) {
    if (full || picked.some((x) => (p.userId ? x.userId === p.userId : !x.userId && x.nickname === p.nickname))) return;
    setPicked([...picked, p]);
    setQuery("");
    setAdding(false);
  }

  return (
    <div className="flex flex-col gap-2 px-5 pt-6">
      <input type="hidden" name="companions" value={value} />
      <span className="text-body font-semibold">함께 간 사람</span>

      {picked.length > 0 && (
        <ul className="flex flex-col">
          {picked.map((p) => (
            <li key={p.userId ?? `g-${p.nickname}`} className="flex min-h-12 items-center gap-2.5">
              <Avatar name={p.nickname} size={40} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body font-medium">{p.userId ? honor(p.nickname) : p.nickname}</span>
                {(p.userId ? STATUS_TEXT[p.status] : "나만 보는 이름") && <span className="text-caption text-muted">{p.userId ? STATUS_TEXT[p.status] : "나만 보는 이름"}</span>}
              </span>
              <button
                type="button"
                aria-label={`${p.nickname} 빼기`}
                onClick={() => setPicked(picked.filter((x) => x !== p))}
                className="flex size-11 items-center justify-center text-subtle"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div ref={panel} className="flex flex-col gap-1 rounded-[16px] bg-surface p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임으로 찾기"
            aria-label="함께 간 사람 찾기"
            className="h-11 rounded-[12px] bg-white px-3.5 text-body outline-none"
          />
          {!query && results.length > 0 && <span className="px-2 pt-1 text-caption text-muted">팔로잉</span>}
          <ul className="flex flex-col">
            {results
              .filter((r) => !picked.some((p) => p.userId === r.id))
              .slice(0, 6)
              .map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => add({ userId: r.id, nickname: r.nickname, status: "new" })} className="flex h-14 w-full items-center gap-2.5 px-2 text-left">
                    <Avatar name={r.nickname} size={40} />
                    <span className="flex-1 truncate text-body">{r.nickname}</span>
                    {r.following && <span className="text-caption text-muted">팔로잉</span>}
                  </button>
                </li>
              ))}
          </ul>
          {query && !searching && results.filter((r) => !picked.some((p) => p.userId === r.id)).length === 0 && (
            <span className="px-2 py-2 text-meta text-muted">이 닉네임을 쓰는 사람이 없어요.</span>
          )}
          {name && (
            <button type="button" onClick={() => add({ userId: null, nickname: name, status: "accepted" })} className="flex h-11 items-center border-t border-line px-2 text-left text-meta text-ink-2">
              <span className="truncate">
                ‘<b className="font-semibold text-ink">{name}</b>’ 이름만 적어 두기
              </span>
            </button>
          )}
          {searching && <span className="px-2 py-1 text-caption text-muted">찾는 중…</span>}
          <button type="button" onClick={() => { setAdding(false); setQuery(""); }} className="h-11 text-meta font-semibold text-ink-2">
            닫기
          </button>
        </div>
      ) : (
        !full && (
          <button type="button" onClick={() => setAdding(true)} className="flex h-11 w-fit items-center gap-1.5 rounded-full bg-surface px-4 text-meta font-semibold text-ink">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            사람 추가
          </button>
        )
      )}

      {picked.some((p) => p.userId) && (
        <>
          <span className="text-caption leading-normal text-muted">상대가 수락하면 이름이 보여요.</span>
          <FeedCheck checked={showInFeed} onChange={setShowInFeed} />
        </>
      )}

      {others.map((v) => (
        <div key={v.visitId} className="mt-2 flex flex-col gap-1.5 rounded-[16px] bg-surface p-4">
          <span className="text-meta text-ink-2">
            <b className="font-semibold text-ink">{honor(v.creatorNickname)}</b>이 함께 갔다고 남겼어요
          </span>
          {v.members.length > 0 && <span className="text-caption text-muted">함께: {v.members.map((m) => honor(m.nickname)).join(", ")}</span>}
          <input type="hidden" name="visitFeedIds" value={v.visitId} />
          <FeedCheck name="visitFeedOn" value={v.visitId} defaultChecked={v.myShowInFeed} />
        </div>
      ))}
    </div>
  );
}

function FeedCheck(props: { checked?: boolean; onChange?: (v: boolean) => void; name?: string; value?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5">
      <input
        type="checkbox"
        name={props.name}
        value={props.value}
        checked={props.checked}
        defaultChecked={props.defaultChecked}
        onChange={props.onChange ? (e) => props.onChange!(e.target.checked) : undefined}
        className="size-5 accent-ink"
      />
      <span className="flex flex-col">
        <span className="text-meta text-ink-2">피드에 내 이름 보이기</span>
        <span className="text-caption text-muted">꺼도 함께 방문한 기록은 남아요.</span>
      </span>
    </label>
  );
}
