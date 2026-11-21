import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CONTACT_EMAIL, EFFECTIVE_DATE } from "./legal";

export type LegalSection = { title: string; body: ReactNode };

// 법률 문서 공통 틀 — 조항 제목 · 본문 · 표 · 시행일
export function LegalPage({ title, intro, sections, closing }: { title: string; intro: ReactNode; sections: LegalSection[]; closing?: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/" title={title} />
      <article className="flex flex-col gap-7 px-5 pt-2 pb-14 text-[14px] leading-[1.75] text-ink-2 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1 [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-meta [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-top [&_td:first-child]:whitespace-nowrap [&_th]:border [&_th]:border-line [&_th]:bg-surface [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5">
        <div className="flex flex-col gap-2">{intro}</div>
        {sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-2.5">
            <h2 className="text-body font-bold text-ink">{s.title}</h2>
            <div className="flex flex-col gap-2.5">{s.body}</div>
          </section>
        ))}
        {closing}
        <p className="border-t border-line pt-5 text-meta text-muted">
          시행일자 {EFFECTIVE_DATE}
          {CONTACT_EMAIL && (
            <>
              <br />
              문의 {CONTACT_EMAIL}
            </>
          )}
        </p>
      </article>
    </main>
  );
}
