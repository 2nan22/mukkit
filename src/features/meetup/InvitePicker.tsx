"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { findInvitees, inviteUser, type InviteCandidate } from "./actions";

// 먹킷 사용자 초대 — 팔로잉 먼저, 닉네임으로 찾기
export function InvitePicker({ meetupId, invited, memberIds }: { meetupId: string; invited: { id: string; nickname: string }[]; memberIds: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<InviteCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const t = setTimeout(() => start(async () => setPeople(await findInvitees(query))), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query]);

  function invite(p: InviteCandidate) {
    start(async () => {
      const res = await inviteUser(meetupId, p.id);
      if (res.error) return setError(res.error);
      setError(null);
      router.refresh();
    });
  }

  const invitedIds = new Set(invited.map((i) => i.id));
  const joined = new Set(memberIds);

  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
      <span className="text-body font-semibold">먹킷에서 찾기</span>
      {invited.length > 0 && <span className="text-meta text-ink-2">초대 보냄 · {invited.map((i) => i.nickname).join(", ")} — 수락을 기다리는 중</span>}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="닉네임"
        aria-label="초대할 사람 닉네임"
        className="h-11 rounded-[12px] border border-transparent bg-white px-3.5 text-body outline-none focus:border-ink"
      />
      {!query && people && people.length > 0 && <span className="pt-1 text-meta text-muted">팔로잉</span>}
      {people && people.length > 0 && (
        <ul className="flex max-h-72 flex-col overflow-y-auto rounded-[12px] bg-white">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
              <Avatar name={p.nickname} size={24} />
              <span className="flex-1 truncate text-body">{p.nickname}</span>
              {p.following && query && <span className="text-caption text-muted">팔로잉</span>}
              {joined.has(p.id) ? (
                <span className="shrink-0 text-meta text-muted">참여 중</span>
              ) : invitedIds.has(p.id) ? (
                <span className="shrink-0 text-meta text-muted">보냄</span>
              ) : (
                <button type="button" disabled={pending} onClick={() => invite(p)} className="h-8 shrink-0 rounded-full bg-brand-soft px-3 text-meta font-bold text-brand">
                  초대
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {people && people.length === 0 && (
        <span className="text-meta text-muted">{query ? "찾는 닉네임이 없어요. 아래 링크로 초대해 보세요." : "팔로우한 사람이 없어요. 닉네임으로 찾거나 링크로 초대해 보세요."}</span>
      )}
      {error && (
        <p role="alert" className="text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
