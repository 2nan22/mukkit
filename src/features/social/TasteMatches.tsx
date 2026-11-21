import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import type { TasteMatch } from "./social";

// 취향이 비슷한 사람 — 같은 가게를 둘 다 평가했을 때 등급이 얼마나 비슷한지
export function TasteMatches({ matches: all, title = "취향이 비슷한 사람" }: { matches: TasteMatch[]; title?: string }) {
  const matches = all.filter((m) => m.overlap > 0);
  if (matches.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-section font-bold">{title}</h2>
        <span className="text-meta text-muted">나와 평가가 비슷한 순</span>
      </div>
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {matches.map((m) => (
          <li key={m.userId} className="shrink-0">
            <Link href={`/u/${m.userId}`} className="flex w-36 flex-col gap-2 rounded-btn-l border border-line p-3">
              <Avatar name={m.nickname} size={40} />
              <span className="truncate text-body font-bold">{m.nickname}</span>
              <span className="flex flex-col text-meta leading-snug text-muted">
                <span>같이 평가한 곳 {m.overlap}</span>
                <span className="whitespace-nowrap">둘 다 3스타 {m.bothThree}곳</span>
              </span>
              <span className="text-meta font-bold text-brand">취향 일치 {Math.round(m.similarity * 100)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
