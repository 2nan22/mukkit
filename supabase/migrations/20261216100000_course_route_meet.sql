-- 코스 길을 만날 곳부터 (88-3, 사용자 '약속 지점에서부터 경로를 보여주는게 맞지') — 만날 곳 › 1차 › 2차를 한 번에 받아 지도에 실제 길로
-- 88 의 따로 받던 만날 곳 › 1차 길(meetup_meet_walk)은 코스 길에 합친다 (운영 배포 전이라 데이터 없음)
drop function public.save_meet_walk(uuid, uuid, double precision, double precision, int, int);
drop table public.meetup_meet_walk;

-- 어느 만날 곳부터 잰 길인지 (null = 만날 곳 없이 1차부터) · legs null = 받기 실패(1시간 뒤 다시)
alter table public.meetup_course_route
  add column meet_lat double precision,
  add column meet_lng double precision,
  alter column legs drop not null,
  alter column path drop not null;

drop function public.save_meetup_course_route(uuid, text, jsonb, jsonb);

-- 받은 길 저장 — 서버(서비스 키)만. 받는 사이 코스나 만날 곳이 바뀌었으면 쓰지 않는다
create function public.save_meetup_course_route(p_meetup uuid, p_key text, p_meet_lat double precision, p_meet_lng double precision, p_legs jsonb, p_path jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select string_agg(place_id::text, ',' order by position) from public.meetup_course where meetup_id = p_meetup), '') <> p_key then
    return false;
  end if;
  if p_meet_lat is not null and not exists (select 1 from public.meetups where id = p_meetup and meet_lat = p_meet_lat and meet_lng = p_meet_lng) then
    return false;
  end if;
  insert into public.meetup_course_route (meetup_id, course_key, meet_lat, meet_lng, legs, path, fetched_at)
  values (p_meetup, p_key, p_meet_lat, p_meet_lng, p_legs, p_path, now())
  on conflict (meetup_id) do update set course_key = excluded.course_key, meet_lat = excluded.meet_lat, meet_lng = excluded.meet_lng,
    legs = excluded.legs, path = excluded.path, fetched_at = excluded.fetched_at;
  return true;
end
$$;
revoke all on function public.save_meetup_course_route(uuid, text, double precision, double precision, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_meetup_course_route(uuid, text, double precision, double precision, jsonb, jsonb) to service_role;
