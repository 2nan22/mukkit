import Link from "next/link";

type Person = { id: string; nickname: string };

// 함께 간 사람 한 줄 — '○○님 · △△님과 함께 방문'
export function Companions({ people }: { people: Person[] }) {
  if (people.length === 0) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-meta text-ink-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mr-0.5 text-muted" aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6" />
        <circle cx="16.5" cy="9" r="2.6" />
        <path d="M15.5 14.4c2.2.1 4 1.5 4.8 4.1" />
      </svg>
      {people.map((p, i) => (
        <span key={p.id}>
          <Link href={`/u/${p.id}`} className="font-semibold text-ink">
            {p.nickname}님
          </Link>
          {i < people.length - 1 ? " ·" : "과 함께 방문"}
        </span>
      ))}
    </p>
  );
}
