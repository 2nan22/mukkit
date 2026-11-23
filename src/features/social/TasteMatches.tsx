import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "./FollowButton";
import type { TasteMatch } from "./social";

// 취향이 비슷한 사람 — 홈과 같은 줄 모양
export function TasteMatches({ matches: all, title = "취향이 비슷한 사람" }: { matches: TasteMatch[]; title?: string }) {
  const matches = all.filter((m) => m.overlap > 0);
  return (
    <section className="flex flex-col gap-1">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section font-bold">{title}</h2>
        <span className="text-meta text-muted">나와 평가가 비슷한 순</span>
      </div>
      {matches.length === 0 ? (
        <p className="rounded-[16px] bg-surface p-4 text-meta leading-normal text-muted">
          같은 가게를 평가한 사람이 생기면 여기에 보여요. 평가를 늘리거나 닉네임으로 찾아보세요.
        </p>
      ) : (
        <ul>
          {matches.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
              <Link href={`/u/${m.userId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={m.nickname} size={40} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-body font-bold">{m.nickname}</span>
                  <span className="truncate text-meta text-muted">
                    {m.bothThree > 0 ? `둘 다 수저 셋 ${m.bothThree}곳` : `같이 평가한 곳 ${m.overlap}곳`} · 취향 일치 {Math.round(m.similarity * 100)}%
                  </span>
                </span>
              </Link>
              <FollowButton targetId={m.userId} following={false} compact />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
