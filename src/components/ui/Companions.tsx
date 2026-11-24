import Link from "next/link";
import { honor } from "@/domain/honor";

type Person = { id: string; nickname: string; isMe?: boolean; guest?: boolean };

function label(p: Person): string {
  return p.isMe ? "나" : p.guest ? p.nickname : honor(p.nickname);
}

// 받침이 있으면 '과', 없으면 '와'
function withParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 === 0 ? "와" : "과";
}

// 함께 간 사람 한 줄 — '○○님 · 나와 함께 방문', 3명 이상은 '○○님 · △△님 외 n명과'
export function Companions({ people }: { people: Person[] }) {
  if (people.length === 0) return null;
  const all = [...people].sort((a, b) => Number(Boolean(a.isMe)) - Number(Boolean(b.isMe)));
  const sorted = all.slice(0, 2);
  const extra = all.length - sorted.length;
  const last = extra > 0 ? `외 ${extra}명` : label(sorted[sorted.length - 1]);
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-meta text-ink-2">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mr-0.5 text-muted" aria-hidden="true">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19c.8-3 3-4.6 5.5-4.6s4.7 1.6 5.5 4.6" />
        <circle cx="16.5" cy="9" r="2.6" />
        <path d="M15.5 14.4c2.2.1 4 1.5 4.8 4.1" />
      </svg>
      {sorted.map((p, i) => (
        <span key={p.id}>
          {p.isMe || p.guest ? (
            <span className="font-semibold text-ink">{label(p)}</span>
          ) : (
            <Link href={`/u/${p.id}`} className="-my-2 py-2 font-semibold text-ink">
              {label(p)}
            </Link>
          )}
          {i < sorted.length - 1 ? "," : extra > 0 ? ` 외 ${extra}명과 함께 방문` : `${withParticle(last)} 함께 방문`}
        </span>
      ))}
    </p>
  );
}
