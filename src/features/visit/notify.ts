import "server-only";
import { honor } from "@/domain/honor";
import { sendPush } from "@/features/push/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 함께 간 사람으로 태그됐을 때 — 장소 이름은 싣지 않는다 (잠금 화면)
export async function notifyVisitTag(actorId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { data: actor } = await admin.from("profiles").select("nickname").eq("id", actorId).maybeSingle();
  if (!actor) return;
  await sendPush(userIds, { title: "함께 방문", body: `${honor(actor.nickname as string)}이 함께 갔다고 남겼어요`, url: "/visits", tag: "visit-tags" }, "visit");
}
