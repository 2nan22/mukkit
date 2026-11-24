import "server-only";
import { honor } from "@/domain/honor";
import { sendPush } from "@/features/push/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 약속 알림 — 위치 · 동네 · 약속 목적은 알림에 싣지 않는다 (잠금 화면에 보이므로)
// 제목에는 일어난 일, 본문에는 사람 (66 디자인 검토)
type Event = { kind: "invited"; to: string } | { kind: "joined" } | { kind: "located"; point: "origin" | "return" };

export async function notifyMeetup(meetupId: string, actorId: string, event: Event): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const [{ data: meetup }, { data: actor }, { data: members }] = await Promise.all([
    admin.from("meetups").select("status").eq("id", meetupId).maybeSingle(),
    admin.from("profiles").select("nickname").eq("id", actorId).maybeSingle(),
    admin.from("meetup_members").select("user_id").eq("meetup_id", meetupId),
  ]);
  if (!meetup || meetup.status !== "open" || !actor) return;
  const name = honor(actor.nickname as string);
  const url = `/meet/${meetupId}`;
  const others = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id !== actorId);

  if (event.kind === "invited") {
    await sendPush([event.to], { title: "약속 초대", body: `${name}이 초대했어요`, url, tag: `invite-${meetupId}` }, "meetup");
    return;
  }
  if (event.kind === "joined") {
    // 이미 참여한 사람이 링크를 다시 열어도 알리지 않게 — 방금 들어온 경우만
    const { data: row } = await admin.from("meetup_members").select("joined_at").eq("meetup_id", meetupId).eq("user_id", actorId).maybeSingle();
    if (!row || Date.now() - new Date(row.joined_at as string).getTime() > 120_000) return;
    await sendPush(others, { title: "약속 참여", body: `${name}이 참여했어요`, url, tag: `meet-${meetupId}` }, "meetup");
    return;
  }
  // 위치를 넣은 사람이 둘 이상이 됐을 때만 — 추천이 새로 나오거나 바뀜
  const { data: pts } = await admin.from("meetup_points").select("user_id").eq("meetup_id", meetupId);
  const ready = new Set(((pts ?? []) as { user_id: string }[]).map((p) => p.user_id));
  if (ready.size < 2) return;
  await sendPush(
    others.filter((id) => ready.has(id)),
    {
      title: ready.size === 2 ? "추천 지역이 나왔어요" : "추천 지역이 바뀌었어요",
      body: `${name}이 ${event.point === "origin" ? "출발지" : "귀가지"}를 넣었어요`,
      url,
      tag: `meet-${meetupId}`,
    },
    "meetup",
  );
}
