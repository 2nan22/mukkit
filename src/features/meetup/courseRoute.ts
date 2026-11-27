import "server-only";
import { courseKey, meetLeg, type LatLng } from "@/domain/course";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchWalkRoute } from "./walkRoute";

// 코스 걷는 길 받기 (84 · 88-3) — 만날 곳이 1차와 떨어져 있으면 만날 곳부터 한 번에. 저장은 save_meetup_course_route
// 하루 도보 경로 무료 1,000건 중 이만큼만
const DAILY_CAP = 800;
// 받기 실패 · 오늘 몫 소진은 이만큼 뒤에 다시
const RETRY_MIN = 60;

type Saved = { course_key: string; meet_lat: number | null; meet_lng: number | null; legs: unknown; fetched_at: string } | null;

// 지금 코스 · 만날 곳에 맞는 길이 없을 때만 받는다 — 같은 것이면 아무것도 안 함(여러 번 불러도 됨). 받았으면 true
export async function refreshCourseRoute(meetupId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const [c, m, r] = await Promise.all([
    admin.from("meetup_course").select("place_id, places(lat, lng)").eq("meetup_id", meetupId).order("position"),
    admin.from("meetups").select("meet_lat, meet_lng").eq("id", meetupId).maybeSingle(),
    admin.from("meetup_course_route").select("course_key, meet_lat, meet_lng, legs, fetched_at").eq("meetup_id", meetupId).maybeSingle(),
  ]);
  const rows = (c.data ?? []) as unknown as { place_id: string; places: LatLng | null }[];
  const stops = rows.flatMap((x) => (x.places ? [{ placeId: x.place_id, lat: x.places.lat, lng: x.places.lng }] : []));
  const mr = m.data as { meet_lat: number | null; meet_lng: number | null } | null;
  const meet = mr?.meet_lat != null && mr.meet_lng != null ? { lat: mr.meet_lat, lng: mr.meet_lng } : null;
  const withMeet = meetLeg(meet, stops[0], null)?.atFirst === false;
  const points: LatLng[] = withMeet && meet ? [meet, ...stops] : stops;
  if (points.length < 2) return false;
  const key = courseKey(stops.map((s) => s.placeId));
  const saved = r.data as Saved;
  const sameTarget = saved && saved.course_key === key && saved.meet_lat === (withMeet ? meet!.lat : null) && saved.meet_lng === (withMeet ? meet!.lng : null);
  if (sameTarget && (saved.legs !== null || Date.now() - new Date(saved.fetched_at).getTime() < RETRY_MIN * 60_000)) return false;
  const claim = await admin.rpc("claim_api_calls", { p_api: "kakao_walk", p_n: 1, p_cap: DAILY_CAP });
  const route = claim.data ? await fetchWalkRoute(points) : null;
  await admin.rpc("save_meetup_course_route", {
    p_meetup: meetupId,
    p_key: key,
    p_meet_lat: withMeet ? meet!.lat : null,
    p_meet_lng: withMeet ? meet!.lng : null,
    p_legs: route?.legs ?? null,
    p_path: route?.path ?? null,
  });
  return Boolean(route);
}
