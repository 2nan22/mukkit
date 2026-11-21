import "server-only";
import { sendPush } from "@/features/push/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 약속 알림 — 위치 · 동네 · 약속 목적은 알림에 싣지 않는다 (잠금 화면에 보이므로)
type Event = { kind: "invited"; to: string } | { kind: "joined" } | { kind: "located" };

export async function notifyMeetup(meetupId: string, actorId: string, event: Event): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const [{ data: meetup }, { data: actor }, { data: members }] = await Promise.all([
    admin.from("meetups").select("status").eq("id", meetupId).maybeSingle(),
    admin.from("profiles").select("nickname").eq("id", actorId).maybeSingle(),
    admin.from("meetup_members").select("user_id").eq("meetup_id", meetupId),
  ]);
  if (!meetup || meetup.status !== "open" || !actor) return;
  const name = `${actor.nickname}님`;
  const url = `/meet/${meetupId}`;
  const others = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id !== actorId);

  if (event.kind === "invited") {
    await sendPush([event.to], { title: "약속 초대", body: `${name}이 약속에 초대했어요`, url, tag: `invite-${meetupId}` });
    return;
  }
  if (event.kind === "joined") {
    // 이미 참여한 사람이 링크를 다시 열어도 알리지 않게 — 방금 들어온 경우만
    const { data: row } = await admin.from("meetup_members").select("joined_at").eq("meetup_id", meetupId).eq("user_id", actorId).maybeSingle();
    if (!row || Date.now() - new Date(row.joined_at as string).getTime() > 120_000) return;
    await sendPush(others, { title: "약속", body: `${name}이 참여했어요`, url, tag: `meet-${meetupId}` });
    return;
  }
  // 위치를 넣은 사람이 둘 이상이 됐을 때만 — 추천이 새로 나오거나 바뀜
  const { data: pts } = await admin.from("meetup_points").select("user_id").eq("meetup_id", meetupId);
  const ready = new Set(((pts ?? []) as { user_id: string }[]).map((p) => p.user_id));
  if (ready.size < 2) return;
  await sendPush(
    others.filter((id) => ready.has(id)),
    { title: "약속", body: ready.size === 2 ? `${name}이 위치를 넣어 추천 지역이 나왔어요` : `${name}이 위치를 넣어 추천 지역이 바뀌었어요`, url, tag: `meet-${meetupId}` },
  );
}
