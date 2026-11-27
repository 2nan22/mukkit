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

// 약속 취소 (90) — 약속은 이미 지워져 링크는 약속 목록으로. 받는 사람은 취소 직전 참여자 · 대기 중 초대(만든 사람 빼고)
export async function notifyMeetupCancelled(meetupId: string, actorId: string, to: string[]): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin || to.length === 0) return;
  const { data: actor } = await admin.from("profiles").select("nickname").eq("id", actorId).maybeSingle();
  if (!actor) return;
  await sendPush(to, { title: "약속 취소", body: `${honor(actor.nickname as string)}이 약속을 취소했어요`, url: "/meet", tag: `meet-${meetupId}` }, "meetup");
}

// 코스 변경 (93) — 받는 사람은 DB 가 방금 만든 · 고친 줄. 같은 약속은 30분에 한 번만 울림(DB 가 pushed_at 을 남겨 둠)
export async function notifyCourseChanged(meetupId: string, actorId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const to = await claimFreshNotifications(admin, "meetup_course", actorId, { meetup_id: meetupId });
  if (to.length === 0) return;
  const { data: actor } = await admin.from("profiles").select("nickname").eq("id", actorId).maybeSingle();
  if (!actor) return;
  await sendPush(
    to.map((r) => r.user_id),
    { title: "코스가 바뀌었어요", body: `${honor(actor.nickname as string)}이 코스를 바꿨어요`, url: `/meet/${meetupId}`, tag: `meet-${meetupId}` },
    "meetup",
  );
}
