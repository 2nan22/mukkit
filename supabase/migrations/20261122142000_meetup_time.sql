-- 약속 시간 — 대략의 시작 · 종료, 막차 어림을 위해 지역 점수에 귀가 시간을 따로 돌려준다
alter table public.meetups
  add column starts_at timestamptz,
  add column ends_at timestamptz,
  add constraint meetups_time_order check (ends_at is null or starts_at is null or ends_at > starts_at);

drop function public.meetup_area_scores(uuid, int);
create function public.meetup_area_scores(p_meetup uuid, p_limit int default 10)
returns table (
  name text, lat double precision, lng double precision,
  my_minutes int, partner_minutes int, my_return int, partner_return int, recent int
)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  partner uuid;
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  select case when m.host_id = me then m.guest_id else m.host_id end into partner from public.meetups m where m.id = p_meetup;
  if partner is null then return; end if;
  return query
  with legs as (
    select a.name, a.lat, a.lng, mp.user_id, mp.kind,
           -- 시속 22km 어림 + 갈아타기 · 걷기 8분
           2 * 6371 * asin(sqrt(power(sin(radians(a.lat - mp.lat) / 2), 2)
             + cos(radians(mp.lat)) * cos(radians(a.lat)) * power(sin(radians(a.lng - mp.lng) / 2), 2))) / 22 * 60 + 8 as minutes
    from public.meetup_areas a cross join public.meetup_points mp
    where mp.meetup_id = p_meetup
  ),
  per_user as (
    select l.name, l.lat, l.lng, l.user_id, avg(l.minutes) as avg_m,
           max(l.minutes) filter (where l.kind = 'return') as return_m
    from legs l group by l.name, l.lat, l.lng, l.user_id
  ),
  both_sides as (
    select a.name, a.lat, a.lng,
           round(a.avg_m)::int as my_m, round(b.avg_m)::int as partner_m,
           round(a.return_m)::int as my_r, round(b.return_m)::int as partner_r
    from per_user a join per_user b on b.name = a.name and b.user_id = partner
    where a.user_id = me
  )
  select s.name, s.lat, s.lng, s.my_m, s.partner_m, s.my_r, s.partner_r,
         (select count(*)::int from public.user_places up join public.places pl on pl.id = up.place_id
          where up.tier in ('three', 'two') and not up.sponsored and up.updated_at > now() - interval '30 days'
            and pl.lat between s.lat - 0.012 and s.lat + 0.012 and pl.lng between s.lng - 0.015 and s.lng + 0.015)
  from both_sides s
  order by greatest(s.my_m, s.partner_m), s.my_m + s.partner_m
  limit greatest(1, least(p_limit, 10));
end;
$$;
revoke all on function public.meetup_area_scores(uuid, int) from public, anon;
grant execute on function public.meetup_area_scores(uuid, int) to authenticated;

drop function public.meetup_status(uuid);
create function public.meetup_status(p_meetup uuid)
returns table (
  meetup_id uuid, purpose text, status text, invite_token text, expires_at timestamptz, starts_at timestamptz, ends_at timestamptz,
  is_host boolean, partner_id uuid, partner_nickname text, me_ready boolean, partner_ready boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  m as (
    select * from public.meetups
    where id = p_meetup and (select id from me) in (host_id, guest_id)
  )
  select m.id, m.purpose, m.status,
         case when m.host_id = (select id from me) then m.invite_token end,
         m.expires_at, m.starts_at, m.ends_at,
         m.host_id = (select id from me),
         p.id, p.nickname,
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = (select id from me)),
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = p.id)
  from m
  left join public.profiles p on p.id = case when m.host_id = (select id from me) then m.guest_id else m.host_id end;
$$;
revoke all on function public.meetup_status(uuid) from public, anon;
grant execute on function public.meetup_status(uuid) to authenticated;

-- 초대 미리보기에도 시간
drop function public.meetup_invite(text);
create function public.meetup_invite(p_token text)
returns table (meetup_id uuid, host_nickname text, purpose text, status text, starts_at timestamptz, ends_at timestamptz, joined boolean, is_host boolean, full boolean)
language sql stable security definer set search_path = '' as $$
  select m.id, p.nickname, m.purpose, m.status, m.starts_at, m.ends_at,
         (select auth.uid()) = m.guest_id,
         (select auth.uid()) = m.host_id,
         m.guest_id is not null and (select auth.uid()) is distinct from m.guest_id
  from public.meetups m join public.profiles p on p.id = m.host_id
  where m.invite_token = p_token and m.expires_at > now();
$$;
revoke all on function public.meetup_invite(text) from public;
grant execute on function public.meetup_invite(text) to anon, authenticated;
