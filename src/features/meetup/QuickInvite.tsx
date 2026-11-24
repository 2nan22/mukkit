"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { findInvitees, inviteUser, type InviteCandidate } from "./actions";

// 만든 직후 초대 (67) — 팔로우하는 사람(또는 닉네임 검색) 줄마다 '초대', 누르면 바로 보냄 (인스타그램 보내기처럼)
export function QuickInvite({ meetupId, invited, memberIds }: { meetupId: string; invited: string[]; memberIds: string[] }) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<InviteCandidate[] | null>(null);
  const [sent, setSent] = useState<Set<string>>(() => new Set(invited));
  const [error, setError] = useState<string | null>(null);
  // 검색과 초대를 따로 — 검색 중에도 초대 버튼이 꺼지지 않게, 보내는 줄만 잠깐 꺼짐
  const [, startSearch] = useTransition();
  const [sending, setSending] = useState<Set<string>>(() => new Set());
  const joined = new Set(memberIds);

  // 검색어가 없으면 팔로우하는 사람, 있으면 닉네임으로 찾기
  useEffect(() => {
    let alive = true;
    const t = setTimeout(
      () =>
        startSearch(async () => {
          const found = await findInvitees(query);
          // 늦게 온 앞 검색 응답은 버린다
          if (alive) setPeople(found);
        }),
      query ? 300 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query]);

  async function invite(p: InviteCandidate) {
    setSending((s) => new Set(s).add(p.id));
    const res = await inviteUser(meetupId, p.id);
    setSending((s) => {
      const n = new Set(s);
      n.delete(p.id);
      return n;
    });
    if (res.error) return setError(`${p.nickname}님 — ${res.error}`);
    setError(null);
    setSent((s) => new Set(s).add(p.id));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="닉네임으로 찾기"
        aria-label="초대할 사람 닉네임"
        className="h-11 rounded-[12px] border border-transparent bg-surface px-3.5 text-body outline-none focus:border-ink"
      />
      {people === null && <div className="h-24 animate-pulse rounded-[12px] bg-surface" />}
      {people?.length === 0 && (
        <p className="text-meta text-muted">{query ? "찾는 닉네임이 없어요. 아래 카카오톡으로 초대해 보세요." : "팔로우하는 사람이 없어요. 닉네임으로 찾거나 카카오톡으로 초대해 보세요."}</p>
      )}
      <ul className="flex max-h-72 flex-col overflow-y-auto">
        {(people ?? []).map((p) => (
          <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-line">
            <Avatar name={p.nickname} size={32} />
            <span className="flex-1 truncate text-body">{p.nickname}</span>
            {joined.has(p.id) ? (
              <span className="shrink-0 text-meta text-muted">참여 중</span>
            ) : sent.has(p.id) ? (
              <span className="flex h-9 shrink-0 items-center px-3 text-meta text-muted">보냄</span>
            ) : (
              <button type="button" disabled={sending.has(p.id)} onClick={() => void invite(p)} aria-label={`${p.nickname}님 초대`} className="h-9 shrink-0 rounded-full bg-surface px-4 text-meta font-bold text-ink disabled:opacity-60">
                초대
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="pt-2 text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
