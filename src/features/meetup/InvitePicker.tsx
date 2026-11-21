"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { findInvitees, inviteUser, type InviteCandidate } from "./actions";

// 마이슐랭 사용자 초대 — 팔로잉 먼저, 닉네임으로 찾기
export function InvitePicker({ meetupId, pendingNickname }: { meetupId: string; pendingNickname: string | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<InviteCandidate[] | null>(null);
  const [open, setOpen] = useState(!pendingNickname);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => start(async () => setPeople(await findInvitees(query))), query ? 300 : 0);
    return () => clearTimeout(t);
  }, [query, open]);

  function invite(p: InviteCandidate) {
    start(async () => {
      const res = await inviteUser(meetupId, p.id);
      if (res.error) return setError(res.error);
      setOpen(false);
      router.refresh();
    });
  }

  if (pendingNickname && !open) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-[16px] bg-surface p-4">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-semibold">{pendingNickname}님에게 초대를 보냈어요</span>
          <span className="text-meta text-muted">수락하면 바로 함께 정할 수 있어요</span>
        </span>
        <button type="button" onClick={() => setOpen(true)} className="h-8 shrink-0 rounded-full bg-white px-3.5 text-meta font-semibold text-ink raised-soft">
          다른 분
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-[16px] bg-surface p-4">
      <span className="text-body font-semibold">마이슐랭에서 찾기</span>
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
              <button type="button" disabled={pending} onClick={() => invite(p)} className="h-8 shrink-0 rounded-full bg-brand-soft px-3 text-meta font-bold text-brand">
                초대
              </button>
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
