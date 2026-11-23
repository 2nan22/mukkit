import { PageLoader } from "@/components/ui/EatingLoader";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppHeader } from "@/components/AppHeader";
import { SIGNED_OUT_HOME } from "@/features/auth/paths";
import { SearchView } from "@/features/search/SearchView";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "검색" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      <AppHeader kind="back" fallback="/home" title="검색" />
      <Suspense fallback={<PageLoader />}>
        <SearchLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchLoader({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(SIGNED_OUT_HOME);
  return <SearchView initialQuery={typeof q === "string" ? q.slice(0, 40) : ""} />;
}
