import Link from "next/link";
import { getUnreadCount } from "./notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// 홈 머리 오른쪽 종 — 안 읽은 알림이 있으면 점 (숫자는 9 넘으면 9+)
export async function NotificationBell() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const unread = data?.claims?.sub ? await getUnreadCount(supabase) : 0;
  return (
    <Link href="/notifications" aria-label={unread > 0 ? `알림, 안 읽은 알림 ${unread}개` : "알림"} className="relative flex size-11 items-center justify-center">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 && (
        <span aria-hidden="true" className="absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-none font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
