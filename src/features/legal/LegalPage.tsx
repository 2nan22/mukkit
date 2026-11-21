import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { CONTACT_EMAIL, EFFECTIVE_DATE } from "./legal";

export type LegalSection = { title: string; body: ReactNode };

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/" title={title} />
      <article className="flex flex-col gap-6 px-5 pt-2 pb-12 text-body leading-relaxed text-ink-2">
        <p>{intro}</p>
        {sections.map((s, i) => (
          <section key={s.title} className="flex flex-col gap-2">
            <h2 className="text-section font-bold text-ink">
              {i + 1}. {s.title}
            </h2>
            <div className="flex flex-col gap-2 [&_li]:ml-4 [&_li]:list-disc">{s.body}</div>
          </section>
        ))}
        <p className="border-t border-line pt-4 text-meta text-muted">
          시행일 {EFFECTIVE_DATE}
          <br />
          문의 {CONTACT_EMAIL || "정식 공개 때 안내해요"}
        </p>
      </article>
    </main>
  );
}
