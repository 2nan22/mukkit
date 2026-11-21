import "server-only";
import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PushMessage = { title: string; body: string; url: string; tag?: string };

let configured: boolean | null = null;
function configure(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  configured = Boolean(pub && priv && subject);
  if (configured) webpush.setVapidDetails(subject!, pub!, priv!);
  return configured;
}

type Row = { id: string; endpoint: string; p256dh: string; auth: string };

// 사람들에게 푸시 보내기 — 키가 없으면 조용히 건너뜀. 없어진 구독(404 · 410)은 지운다
// 실패해도 원래 작업을 막지 않도록 after() 안에서 부른다
export async function sendPush(userIds: string[], message: PushMessage): Promise<number> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0 || !configure()) return 0;
  const admin = createSupabaseAdminClient();
  if (!admin) return 0;
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids);
  const rows = (data ?? []) as Row[];
  const payload = JSON.stringify(message);
  const gone: string[] = [];
  const sent: string[] = [];
  await Promise.all(
    rows.map((r) =>
      webpush
        .sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, { TTL: 60 * 60 * 12, urgency: "normal" })
        .then(() => sent.push(r.id))
        .catch((e: { statusCode?: number }) => {
          if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(r.id);
          else console.warn("[push] 발송 실패: status=%s", e?.statusCode ?? "unknown");
        }),
    ),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  if (sent.length) await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", sent);
  return sent.length;
}
