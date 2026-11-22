"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

// 알림함을 연 뒤 화면에서 부른다 — 렌더 중에 쓰지 않게
export async function markNotificationsRead(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.rpc("mark_notifications_read");
}
