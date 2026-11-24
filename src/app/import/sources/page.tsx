import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { getImportSources } from "@/features/import/importSources";
import { ImportSourceList } from "@/features/import/ImportSourceList";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "가져온 원본" };

// 가져온 원본 관리 (42) — 네이버 · 카카오 원본마다 마지막 확인 · 끊기 · 지우기
export default function ImportSourcesPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/lists" title="가져온 원본" />
      <Suspense fallback={<ListSkeleton />}>
        <Sources />
      </Suspense>
      <div className="flex-1" />
      <div className="sticky bottom-0 bg-white px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <Link href="/import" className="flex h-btn-l items-center justify-center rounded-btn-m bg-brand text-body font-bold text-white">
          새로 가져오기
        </Link>
      </div>
    </main>
  );
}

async function Sources() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect(SIGNED_OUT_HOME);
  const rows = await getImportSources(supabase, userId);
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-5 py-16 text-center">
        <span className="text-body font-semibold">가져온 원본이 없어요</span>
        <span className="text-meta text-muted">네이버 지도나 카카오맵 리스트를 가져오면 여기에 모여요</span>
      </div>
    );
  }
  return <ImportSourceList rows={rows} />;
}
