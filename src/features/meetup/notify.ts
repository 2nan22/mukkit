import "server-only";
import { honor } from "@/domain/honor";
import { claimFreshNotifications } from "@/features/push/claim";
import { sendPush } from "@/features/push/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 약속 알림 — 위치 · 동네 · 약속 목적은 알림에 싣지 않는다 (잠금 화면에 보이므로)
// 제목에는 일어난 일, 본문에는 사람 (66 디자인 검토)
type Event = { kind: "invited"; to: string } | { kind: "joined" } | { kind: "located"; point: "origin" | "return" };

export async function notifyMeetup(meetupId: string, actorId: string, event: Event): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const [{ data: meetup }, { data: actor }] = await Promise.all([
    admin.from("meetups").select("status").eq("id", meetupId).maybeSingle(),
    admin.from("profiles").select("nickname").eq("id", actorId).maybeSingle(),
  ]);
  if (!meetup || meetup.status !== "open" || !actor) return;
  const name = honor(actor.nickname as string);
  const url = `/meet/${meetupId}`;

  if (event.kind === "invited") {
    await sendPush([event.to], { title: "약속 초대", body: `${name}이 초대했어요`, url, tag: `invite-${meetupId}` }, "meetup");
    return;
  }
  // 참여 · 추천 지역 — 받는 사람은 알림함 트리거가 방금 만든 줄 (차단 · 되풀이 거르기가 알림함과 같게, 66)
  if (event.kind === "joined") {
    const to = await claimFreshNotifications(admin, "meetup_join", actorId, { meetup_id: meetupId });
    await sendPush(to.map((r) => r.user_id), { title: "약속 참여", body: `${name}이 참여했어요`, url, tag: `meet-${meetupId}` }, "meetup");
    return;
  }
  const to = await claimFreshNotifications(admin, "meetup_ready", actorId, { meetup_id: meetupId });
  if (to.length === 0) return;
  await sendPush(
    to.map((r) => r.user_id),
    {
      title: to[0].first_ready ? "추천 지역이 나왔어요" : "추천 지역이 바뀌었어요",
      body: `${name}이 ${event.point === "origin" ? "출발지" : "귀가지"}를 넣었어요`,
      url,
      tag: `meet-${meetupId}`,
    },
    "meetup",
  );
}
