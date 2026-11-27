-- 만날 곳에서 1차까지 실제 걷는 길 (88) — 86 은 직선 어림. 만날 곳이나 1차가 바뀌면 서버가 카카오 도보 경로를 한 번 받아 둔다
-- 저장 값은 어느 만날 곳(좌표) · 어느 1차의 것인지 함께 — 화면은 지금 것과 같을 때만 쓰고, 아니면 직선 어림
create table public.meetup_meet_walk (
  meetup_id uuid primary key references public.meetups (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  meet_lat double precision not null,
  meet_lng double precision not null,
  -- null = 받기 실패 (1시간 뒤 다시)
  meters int,
  seconds int,
  fetched_at timestamptz not null default now()
);
alter table public.meetup_meet_walk enable row level security;
create policy "만날 곳 걷는 길은 참여자만 봄" on public.meetup_meet_walk for select to authenticated using (public.is_meetup_member(meetup_id));
revoke insert, update, delete on public.meetup_meet_walk from anon, authenticated;

-- 받은 길 저장 — 서버(서비스 키)만. 받는 사이 만날 곳이나 1차가 또 바뀌었으면 쓰지 않는다
create function public.save_meet_walk(p_meetup uuid, p_place uuid, p_lat double precision, p_lng double precision, p_meters int, p_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.meetups where id = p_meetup and meet_lat = p_lat and meet_lng = p_lng)
     or (select place_id from public.meetup_course where meetup_id = p_meetup order by position limit 1) is distinct from p_place then
    return false;
  end if;
  insert into public.meetup_meet_walk (meetup_id, place_id, meet_lat, meet_lng, meters, seconds, fetched_at)
  values (p_meetup, p_place, p_lat, p_lng, p_meters, p_seconds, now())
  on conflict (meetup_id) do update set place_id = excluded.place_id, meet_lat = excluded.meet_lat, meet_lng = excluded.meet_lng,
    meters = excluded.meters, seconds = excluded.seconds, fetched_at = excluded.fetched_at;
  return true;
end
$$;
revoke all on function public.save_meet_walk(uuid, uuid, double precision, double precision, int, int) from public, anon, authenticated;
grant execute on function public.save_meet_walk(uuid, uuid, double precision, double precision, int, int) to service_role;
