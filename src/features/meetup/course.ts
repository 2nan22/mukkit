import type { SupabaseClient } from "@supabase/supabase-js";
import type { Cuisine } from "@/domain/cuisine";
import { courseKey, straightRoute, type CourseRoute, type Leg } from "@/domain/course";

// 약속 코스 읽기 (84) — 참여자만(RLS). 저장된 길이 지금 순서의 것이 아니면 직선 어림
export type CourseStop = { placeId: string; name: string; cuisine: Cuisine; address: string; lat: number; lng: number };
export type Course = { stops: CourseStop[]; route: CourseRoute | null };

type StopRow = { place_id: string; position: number; places: { name: string; cuisine: string; address: string; lat: number; lng: number } | null };

export async function getCourse(supabase: SupabaseClient, meetupId: string): Promise<Course> {
  const [stopsRes, routeRes] = await Promise.all([
    supabase.from("meetup_course").select("place_id, position, places(name, cuisine, address, lat, lng)").eq("meetup_id", meetupId).order("position"),
    supabase.from("meetup_course_route").select("course_key, legs, path").eq("meetup_id", meetupId).maybeSingle(),
  ]);
  const stops = ((stopsRes.data ?? []) as unknown as StopRow[]).flatMap((r) =>
    r.places ? [{ placeId: r.place_id, name: r.places.name, cuisine: r.places.cuisine as Cuisine, address: r.places.address, lat: r.places.lat, lng: r.places.lng }] : [],
  );
  if (stops.length < 2) return { stops, route: null };
  const saved = routeRes.data as { course_key: string; legs: Leg[]; path: [number, number][] } | null;
  if (saved && saved.course_key === courseKey(stops.map((s) => s.placeId)) && saved.legs.length === stops.length - 1) {
    return { stops, route: { legs: saved.legs, path: saved.path, estimated: false } };
  }
  return { stops, route: straightRoute(stops) };
}
