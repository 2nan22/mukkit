"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { findInvitees, type InviteCandidate } from "@/features/meetup/actions";
import { MAX_COMPANIONS, type MyVisit } from "./visit";

type Picked = { userId: string | null; nickname: string; status: "invited" | "accepted" | "declined" | "new" };

const STATUS_TEXT: Record<Picked["status"], string> = { new: "저장하면 요청", invited: "수락 대기", accepted: "", declined: "거절함" };

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
                <span className="truncate text-body font-medium">{p.userId ? `${p.nickname}님` : p.nickname}</span>
                {(p.userId ? STATUS_TEXT[p.status] : "이름만 메모 · 나만 봐요") && (
                  <span className={`text-caption ${p.status === "declined" ? "text-danger" : "text-muted"}`}>{p.userId ? STATUS_TEXT[p.status] : "이름만 메모 · 나만 봐요"}</span>
                )}
              </span>
              <button
                type="button"
                aria-label={`${p.nickname} 빼기`}
                onClick={() => setPicked(picked.filter((x) => x !== p))}
                className="flex size-10 items-center justify-center text-subtle"
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
        <div className="flex flex-col gap-1 rounded-[16px] bg-surface p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="닉네임 또는 이름"
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
                  <button type="button" onClick={() => add({ userId: r.id, nickname: r.nickname, status: "new" })} className="flex h-12 w-full items-center gap-2.5 px-2 text-left">
                    <Avatar name={r.nickname} size={24} />
                    <span className="flex-1 truncate text-body">{r.nickname}</span>
                    {r.following && <span className="text-caption text-muted">팔로잉</span>}
                  </button>
                </li>
              ))}
          </ul>
          {name && (
            <button type="button" onClick={() => add({ userId: null, nickname: name, status: "accepted" })} className="flex h-11 items-center px-2 text-left text-meta text-ink-2">
              <span className="truncate">
                ‘<b className="font-semibold text-ink">{name}</b>’ 이름으로만 추가
              </span>
            </button>
          )}
          {searching && <span className="px-2 py-1 text-caption text-muted">찾는 중…</span>}
          <button type="button" onClick={() => { setAdding(false); setQuery(""); }} className="h-10 text-meta font-semibold text-ink-2">
            닫기
          </button>
        </div>
      ) : (
        !full && (
          <button type="button" aria-label="함께 간 사람 추가" onClick={() => setAdding(true)} className="flex h-11 w-fit items-center gap-1.5 rounded-full bg-surface px-4 text-meta font-semibold text-ink">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            추가
          </button>
        )
      )}

      <span className="text-caption leading-normal text-muted">마이슐랭 사용자는 수락해야 이름이 보이고, 각자 자기 등급을 남겨요.</span>
      {picked.some((p) => p.userId) && (
        <label className="flex min-h-11 items-center gap-2.5">
          <input type="checkbox" checked={showInFeed} onChange={(e) => setShowInFeed(e.target.checked)} className="size-5 accent-ink" />
          <span className="text-meta text-ink-2">피드에 함께 방문 소식 보이기</span>
        </label>
      )}

      {others.map((v) => (
        <div key={v.visitId} className="mt-2 flex flex-col gap-1.5 rounded-[16px] bg-surface p-4">
          <span className="text-meta text-ink-2">
            <b className="font-semibold text-ink">{v.creatorNickname}님</b>이 함께 간 사람으로 추가했어요
          </span>
          {v.members.length > 0 && <span className="text-caption text-muted">함께: {v.members.map((m) => `${m.nickname}님`).join(" · ")}</span>}
          <input type="hidden" name="visitFeedIds" value={v.visitId} />
          <label className="flex min-h-10 items-center gap-2.5">
            <input type="checkbox" name="visitFeedOn" value={v.visitId} defaultChecked={v.myShowInFeed} className="size-5 accent-ink" />
            <span className="text-meta text-ink-2">피드에 함께 방문 소식 보이기</span>
          </label>
        </div>
      ))}
    </div>
  );
}
