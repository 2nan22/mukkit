import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_COMPANIONS = 10;

export type VisitMember = { id: string; userId: string | null; nickname: string; guest: boolean; status: "invited" | "accepted" | "declined" };
export type MyVisit = {
  visitId: string;
  isCreator: boolean;
  creatorNickname: string;
  visitedOn: string | null;
  meetupId: string | null;
  myShowInFeed: boolean;
  members: VisitMember[];
};
export type CompanionInput = { userIds: string[]; guests: string[]; showInFeed: boolean };
export type ReceivedTag = { visitId: string; placeId: string; placeName: string; creatorId: string; creatorNickname: string; visitedOn: string | null };

type MyVisitRow = {
  visit_id: string; is_creator: boolean; creator_nickname: string; visited_on: string | null; meetup_id: string | null;
  my_status: string; my_show_in_feed: boolean; members: VisitMember[];
};

// 이 장소에서 내가 들어간 방문 — 내가 만든 것이 맨 앞
export async function getMyVisits(supabase: SupabaseClient, placeId: string): Promise<MyVisit[]> {
  const { data, error } = await supabase.rpc("my_visits", { p_place: placeId });
  if (error) throw new Error(`방문 조회 실패: ${error.code}`);
  return ((data ?? []) as MyVisitRow[]).map((r) => ({
    visitId: r.visit_id,
    isCreator: r.is_creator,
    creatorNickname: r.creator_nickname,
    visitedOn: r.visited_on,
    meetupId: r.meetup_id,
    myShowInFeed: r.my_show_in_feed,
    members: r.members,
  }));
}

export async function getReceivedTags(supabase: SupabaseClient): Promise<ReceivedTag[]> {
  const { data, error } = await supabase.rpc("received_visit_tags");
  if (error) throw new Error(`받은 태그 조회 실패: ${error.code}`);
  return ((data ?? []) as { visit_id: string; place_id: string; place_name: string; creator_id: string; creator_nickname: string; visited_on: string | null }[]).map((r) => ({
    visitId: r.visit_id,
    placeId: r.place_id,
    placeName: r.place_name,
    creatorId: r.creator_id,
    creatorNickname: r.creator_nickname,
    visitedOn: r.visited_on,
  }));
}

// 내가 만든 방문의 함께 간 사람을 고른 대로 맞춘다 — 새로 태그한 사용자 id 를 돌려준다(알림용)
export async function syncMyVisit(
  supabase: SupabaseClient,
  me: string,
  placeId: string,
  visitedOn: string | null,
  input: CompanionInput,
  meetupId: string | null = null,
): Promise<{ visitId: string | null; invited: string[] }> {
  const userIds = [...new Set(input.userIds.filter((id) => id !== me))];
  const guests = [...new Set(input.guests.map((g) => g.trim()).filter(Boolean))];
  const { data: found } = await supabase.from("visits").select("id, visited_on").eq("created_by", me).eq("place_id", placeId).maybeSingle();

  if (userIds.length + guests.length === 0) {
    if (found) await supabase.from("visits").delete().eq("id", found.id);
    return { visitId: null, invited: [] };
  }

  let visitId = found?.id as string | undefined;
  if (!visitId) {
    const { data, error } = await supabase.from("visits").insert({ place_id: placeId, created_by: me, visited_on: visitedOn, meetup_id: meetupId }).select("id").single();
    if (error || !data) throw new Error(`방문 만들기 실패: ${error?.code}`);
    visitId = data.id as string;
  } else if (found!.visited_on !== visitedOn) {
    await supabase.from("visits").update({ visited_on: visitedOn }).eq("id", visitId);
  }

  const { data: rows } = await supabase.from("visit_members").select("id, user_id, guest_name").eq("visit_id", visitId);
  const current = (rows ?? []) as { id: string; user_id: string | null; guest_name: string | null }[];
  const drop = current.filter((m) => m.user_id !== me && (m.user_id ? !userIds.includes(m.user_id) : !guests.includes(m.guest_name ?? "")));
  if (drop.length) await supabase.from("visit_members").delete().in("id", drop.map((m) => m.id));

  const haveUsers = new Set(current.map((m) => m.user_id).filter(Boolean));
  const haveGuests = new Set(current.map((m) => m.guest_name).filter(Boolean));
  const invited = userIds.filter((id) => !haveUsers.has(id));
  const add = [
    ...invited.map((user_id) => ({ visit_id: visitId, user_id, guest_name: null, status: "invited" })),
    ...guests.filter((g) => !haveGuests.has(g)).map((guest_name) => ({ visit_id: visitId, user_id: null, guest_name, status: "accepted" })),
  ];
  if (add.length) {
    const { error } = await supabase.from("visit_members").insert(add);
    if (error) throw new Error(`함께 간 사람 저장 실패: ${error.code}`);
  }
  await supabase.rpc("set_visit_feed", { p_visit: visitId, p_show: input.showInFeed });
  return { visitId, invited };
}
