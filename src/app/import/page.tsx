import { AppHeader } from "@/components/AppHeader";
import { ImportFlow } from "@/features/import/ImportFlow";

export const metadata = { title: "가져오기" };

export default function ImportPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="close" fallback="/home" title="저장한 장소 가져오기" />
      <ImportFlow />
    </main>
  );
}
