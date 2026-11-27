import "server-only";
import { meetLeg } from "@/domain/course";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchWalkRoute } from "./walkRoute";

// 만날 곳 › 1차 걷는 길 (88) — 하루 도보 경로 무료 1,000건 중 이만큼만 (코스 길 몫을 남김)
const DAILY_CAP = 300;
// 받기 실패한 길은 이만큼 뒤에 다시
const ERROR_RETRY_MIN = 60;

// 지금 만날 곳 · 1차에 맞는 길이 없으면 한 번 받아 저장한다. 받았으면 true. 실패도 저장해 1시간 동안 다시 부르지 않음
export async function refreshMeetWalk(meetupId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const [m, c, w] = await Promise.all([
    admin.from("meetups").select("meet_lat, meet_lng").eq("id", meetupId).maybeSingle(),
    admin.from("meetup_course").select("place_id, places(lat, lng)").eq("meetup_id", meetupId).order("position").limit(1).maybeSingle(),
    admin.from("meetup_meet_walk").select("place_id, meet_lat, meet_lng, meters, seconds, fetched_at").eq("meetup_id", meetupId).maybeSingle(),
  ]);
  const meetRow = m.data as { meet_lat: number | null; meet_lng: number | null } | null;
  const firstRow = c.data as unknown as { place_id: string; places: { lat: number; lng: number } | null } | null;
  if (meetRow?.meet_lat == null || meetRow.meet_lng == null || !firstRow?.places) return false;
  const meet = { lat: meetRow.meet_lat, lng: meetRow.meet_lng };
  const first = { placeId: firstRow.place_id, ...firstRow.places };
  const saved = w.data as { place_id: string; meet_lat: number; meet_lng: number; meters: number | null; seconds: number | null; fetched_at: string } | null;
  const savedWalk = saved ? { placeId: saved.place_id, lat: saved.meet_lat, lng: saved.meet_lng, meters: saved.meters, seconds: saved.seconds } : null;
  const leg = meetLeg(meet, first, savedWalk);
  if (!leg || leg.atFirst || !leg.estimated) return false;
  // 같은 곳 · 같은 1차인데 최근에 실패했으면 기다림
  const sameTarget = saved && saved.place_id === first.placeId && saved.meet_lat === meet.lat && saved.meet_lng === meet.lng;
  if (sameTarget && Date.now() - new Date(saved.fetched_at).getTime() < ERROR_RETRY_MIN * 60_000) return false;
  const claim = await admin.rpc("claim_api_calls", { p_api: "kakao_walk_meet", p_n: 1, p_cap: DAILY_CAP });
  // 오늘 몫을 다 썼으면 실패로 적어 1시간 동안 화면마다 다시 묻지 않게
  const route = claim.data ? await fetchWalkRoute([meet, first]) : null;
  const got = route?.legs[0] ?? null;
  await admin.rpc("save_meet_walk", {
    p_meetup: meetupId,
    p_place: first.placeId,
    p_lat: meet.lat,
    p_lng: meet.lng,
    p_meters: got ? Math.round(got.meters) : null,
    p_seconds: got ? Math.round(got.seconds) : null,
  });
  return Boolean(got);
}
