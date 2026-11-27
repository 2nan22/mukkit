import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { courseKey, meetLeg, straightRoute, type CourseRoute, type Leg, type MeetWalk } from "@/domain/course";

// 약속 코스 읽기 (84) — 참여자만(RLS). 저장된 길이 지금 순서 · 만날 곳의 것이 아니면 직선 어림
// 만날 곳이 1차와 떨어져 있으면 저장된 길은 만날 곳부터 (88-3) — 첫 구간은 meetWalk 로, 선(path)은 만날 곳에서 시작
export type CourseStop = { placeId: string; name: string; cuisine: Cuisine; address: string; lat: number; lng: number };
// stale: 받아 둔 길이 없거나 옛것 — 화면을 그린 뒤 서버가 받는다
export type Course = { stops: CourseStop[]; route: CourseRoute | null; meetWalk: MeetWalk | null; stale: boolean };

type StopRow = { place_id: string; position: number; places: { name: string; cuisine: string; address: string; lat: number; lng: number } | null };
type RouteRow = { course_key: string; meet_lat: number | null; meet_lng: number | null; legs: Leg[] | null; path: [number, number][] | null; fetched_at: string };

const RETRY_MIN = 60;

export async function getCourse(supabase: SupabaseClient, meetupId: string): Promise<Course> {
  const [stopsRes, routeRes, meetRes] = await Promise.all([
    supabase.from("meetup_course").select("place_id, position, places(name, cuisine, address, lat, lng)").eq("meetup_id", meetupId).order("position"),
    supabase.from("meetup_course_route").select("course_key, meet_lat, meet_lng, legs, path, fetched_at").eq("meetup_id", meetupId).maybeSingle(),
    supabase.from("meetups").select("meet_lat, meet_lng").eq("id", meetupId).maybeSingle(),
  ]);
  const stops = ((stopsRes.data ?? []) as unknown as StopRow[]).flatMap((r) =>
    r.places ? [{ placeId: r.place_id, name: r.places.name, cuisine: r.places.cuisine as Cuisine, address: r.places.address, lat: r.places.lat, lng: r.places.lng }] : [],
  );
  const mr = meetRes.data as { meet_lat: number | null; meet_lng: number | null } | null;
  const meet = mr?.meet_lat != null && mr.meet_lng != null ? { lat: mr.meet_lat, lng: mr.meet_lng } : null;
  const withMeet = meetLeg(meet, stops[0], null)?.atFirst === false;
  const measurable = stops.length >= 2 || withMeet;
  const estimate = { stops, route: stops.length >= 2 ? straightRoute(stops) : null, meetWalk: null };
  if (!measurable) return { ...estimate, stale: false };

  const saved = routeRes.data as RouteRow | null;
  const sameTarget =
    saved !== null && saved.course_key === courseKey(stops.map((s) => s.placeId)) && saved.meet_lat === (withMeet ? meet!.lat : null) && saved.meet_lng === (withMeet ? meet!.lng : null);
  const legs = sameTarget && saved.legs ? (withMeet ? saved.legs.slice(1) : saved.legs) : null;
  if (!sameTarget || !saved.legs || !saved.path || !legs || legs.length !== stops.length - 1) {
    // 같은 대상인데 실패한 지 얼마 안 됐으면 다시 부르지 않음
    const waiting = sameTarget && saved.legs === null && Date.now() - new Date(saved.fetched_at).getTime() < RETRY_MIN * 60_000;
    return { ...estimate, stale: !waiting };
  }
  const meetWalk = withMeet ? { placeId: stops[0].placeId, lat: meet!.lat, lng: meet!.lng, meters: saved.legs[0].meters, seconds: saved.legs[0].seconds } : null;
  return { stops, route: { legs, path: saved.path, estimated: false }, meetWalk, stale: false };
}
