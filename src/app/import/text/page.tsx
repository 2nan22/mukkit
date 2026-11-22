import { AppHeader } from "@/components/AppHeader";
import { TextImportFlow } from "@/features/textImport/TextImportFlow";

export const metadata = { title: "글에서 가게 찾기" };

// SNS · 블로그 글에서 가게 찾기 — 인스타그램은 게시물을 읽어 오는 공식 통로가 없어 글을 붙여 넣는다
export default function TextImportPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" title="글에서 가게 찾기" fallback="/import" />
      <TextImportFlow />
    </main>
  );
}
