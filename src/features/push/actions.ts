"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const Subscription = z.object({
  endpoint: z.url().startsWith("https://").max(999),
  keys: z.object({ p256dh: z.string().min(1).max(199), auth: z.string().min(1).max(99) }),
});

// 이 기기의 푸시 구독 저장 — 같은 기기(endpoint)를 다른 계정이 쓰던 경우 그 줄은 서버가 정리하지 못하므로 먼저 내 것만 지우고 넣는다
export async function savePushSubscription(input: unknown): Promise<{ error?: string }> {
  const parsed = Subscription.safeParse(input);
  if (!parsed.success) return { error: "알림을 켜지 못했어요." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  if (!me) return { error: "로그인이 필요해요." };
  const s = parsed.data;
  await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ user_id: me, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth });
  return error ? { error: "알림을 켜지 못했어요." } : {};
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (typeof endpoint !== "string" || endpoint.length > 999) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
