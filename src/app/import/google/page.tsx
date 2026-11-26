import { AppHeader } from "@/components/AppHeader";
import { GoogleImport } from "@/features/import/google/GoogleImport";

export const metadata = { title: "구글 지도에서 가져오기" };

// 구글 지도 저장 리스트 — 테이크아웃 파일로 (76)
export default function GoogleImportPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/import" title="구글 지도에서 가져오기" />
      <GoogleImport />
    </main>
  );
}
