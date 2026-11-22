import Link from "next/link";

// 지도 머리 오른쪽 — 내 장소 · 팔로잉 지도 전환 (선택은 검정)
export async function MapViewSwitch({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const { view } = await searchParams;
  const following = view === "following";
  const item = (on: boolean) => `flex h-11 items-center rounded-full px-4 text-meta ${on ? "bg-ink font-bold text-white" : "text-ink-2"}`;
  return (
    <nav aria-label="지도 보기" className="mr-3 flex rounded-full bg-surface p-0.5">
      <Link href="/map" replace aria-current={!following ? "page" : undefined} className={item(!following)}>
        내 장소
      </Link>
      <Link href="/map?view=following" replace aria-current={following ? "page" : undefined} className={item(following)}>
        팔로잉
      </Link>
    </nav>
  );
}
