-- 86 만날 곳 · 대중교통 시간 (사용자 2026-11-27 '대중교통 기준이 더 정확', '어디서 보자 하고 만나서 이동')
-- 지역 순위 · 사람별 시간은 대중교통으로 잰 값이 있으면 그것을, 없으면 지금처럼 직선 어림
-- 대중교통은 카카오맵 REST (하루 1,000건 무료) — 화면을 열 때 '아직 안 잰 구간'만 서버가 뒤에서 잰다

-- 지역 대표 역 — 만날 곳 기본값(지역 가운데 좌표가 역 근처)
alter table public.meetup_areas add column station_name text;
update public.meetup_areas a set station_name = v.station from (values
  ('강남역', '강남역'), ('신논현/교대', '신논현역'), ('선릉/삼성', '선릉역'), ('고속터미널', '고속터미널역'), ('사당', '사당역'),
  ('신림', '신림역'), ('홍대입구', '홍대입구역'), ('합정/망원', '합정역'), ('신촌', '신촌역'), ('성수', '성수역'),
  ('건대입구', '건대입구역'), ('왕십리', '왕십리역'), ('을지로', '을지로입구역'), ('종로/광화문', '광화문역'), ('명동', '명동역'),
  ('혜화', '혜화역'), ('서울역', '서울역'), ('용산/삼각지', '삼각지역'), ('이태원/한남', '이태원역'), ('여의도', '여의도역'),
  ('영등포', '영등포역'), ('목동', '오목교역'), ('구로디지털단지', '구로디지털단지역'), ('잠실', '잠실역'), ('노원', '노원역'),
  ('수유', '수유역'), ('판교', '판교역'), ('정자/서현', '서현역'), ('수원역', '수원역'), ('부평', '부평역'),
  ('일산 정발산', '정발산역'), ('서면', '서면역'), ('해운대', '해운대역'), ('동성로', '반월당역'), ('둔산', '정부청사역'),
  ('충장로', '문화전당역')
) as v(name, station) where a.name = v.name;

-- 만날 곳 — 참여자 모두에게 보임. 비어 있으면 화면이 추천 지역 대표 역을 권한다
alter table public.meetups
  add column meet_label text check (char_length(meet_label) <= 40),
  add column meet_lat double precision,
  add column meet_lng double precision,
  add column meet_area text;

-- 대중교통 구간 캐시 — 약속 · 사람과 묶지 않은 좌표 칸끼리(출발은 이미 약 1km 칸) · 서버(서비스 키)만 읽고 씀
-- status: ok · none(경로 없음) · pending(누가 재는 중) · error(호출 실패, 1시간 뒤 다시) — 같은 구간을 되풀이해 부르지 않는다
create table public.transit_legs (
  from_cell text not null,
  to_cell text not null,
  minutes int,
  status text not null check (status in ('ok', 'none', 'pending', 'error')),
  fetched_at timestamptz not null default now(),
  primary key (from_cell, to_cell)
);
alter table public.transit_legs enable row level security;
revoke all on public.transit_legs from anon, authenticated;

-- 좌표 칸 이름 — 출발 · 귀가는 0.01°(약 1km), 지역은 0.001°
create function public.geo_cell(p_lat double precision, p_lng double precision, p_digits int)
returns text language sql immutable set search_path = '' as $$
  select round(p_lat::numeric, p_digits)::text || ',' || round(p_lng::numeric, p_digits)::text
$$;

-- 하루 호출 수 — 상한을 넘으면 거절(그날은 직선 어림)
create table public.api_usage (
  day date not null,
  api text not null,
  calls int not null default 0,
  primary key (day, api)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

create function public.claim_api_calls(p_api text, p_n int, p_cap int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_calls int;
begin
  insert into public.api_usage (day, api, calls) values ((now() at time zone 'Asia/Seoul')::date, p_api, 0)
  on conflict (day, api) do nothing;
  update public.api_usage set calls = calls + p_n
   where day = (now() at time zone 'Asia/Seoul')::date and api = p_api and calls + p_n <= p_cap
  returning calls into v_calls;
  return v_calls is not null;
end
$$;
revoke all on function public.claim_api_calls(text, int, int) from public, anon, authenticated;
grant execute on function public.claim_api_calls(text, int, int) to service_role;

-- 1.5km 안 — 대중교통을 재지 않고 걸어서 어림 (needs · scores 가 같은 경계를 쓰게 한 곳에)
create function public.walk_only(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns boolean language sql immutable set search_path = '' as $$
  select 2 * 6371 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2)
    + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))) < 1.5
$$;

-- 직선 어림(분) — 시속 22km + 갈아타기 · 걷기 8분. 1.5km 안은 걸어서(직선 × 1.3, 시속 4.5km)
create function public.straight_minutes(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable set search_path = '' as $$
  with d as (
    select 2 * 6371 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2)
      + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2))) as km
  )
  select case when km < 1.5 then km * 1.3 / 4.5 * 60 else km / 22 * 60 + 8 end from d
$$;

-- 아직 안 잰 구간 — 화면에 보여 줄 지역(p_areas, 서버가 고른 3곳) × 참여자 출발 · 귀가. 1.5km 안은 빼고, 같은 칸은 한 번. 서버만
create function public.meetup_transit_needs(p_meetup uuid, p_areas text[])
returns table (from_cell text, to_cell text, from_lat double precision, from_lng double precision, to_lat double precision, to_lng double precision)
language sql stable security definer set search_path = '' as $$
  with pts as (select mp.kind, mp.lat, mp.lng from public.meetup_points mp where mp.meetup_id = p_meetup),
  top as (select a.name, a.lat, a.lng from public.meetup_areas a where a.name = any (p_areas)),
  legs as (
    -- 출발: 집 → 지역, 귀가: 지역 → 집
    select case when p.kind = 'origin' then p.lat else t.lat end as f_lat, case when p.kind = 'origin' then p.lng else t.lng end as f_lng,
           case when p.kind = 'origin' then t.lat else p.lat end as t_lat, case when p.kind = 'origin' then t.lng else p.lng end as t_lng,
           case when p.kind = 'origin' then 2 else 3 end as f_digits, case when p.kind = 'origin' then 3 else 2 end as t_digits
    from top t cross join pts p
    where not public.walk_only(p.lat, p.lng, t.lat, t.lng)
  )
  select distinct on (fc, tc) fc, tc, f_lat, f_lng, t_lat, t_lng
  from (select public.geo_cell(f_lat, f_lng, f_digits) fc, public.geo_cell(t_lat, t_lng, t_digits) tc, f_lat, f_lng, t_lat, t_lng from legs) x
  where not exists (select 1 from public.transit_legs tl where tl.from_cell = x.fc and tl.to_cell = x.tc)
$$;
revoke all on function public.meetup_transit_needs(uuid, text[]) from public, anon, authenticated;
grant execute on function public.meetup_transit_needs(uuid, text[]) to service_role;

-- 지역 점수 — 대중교통으로 잰 값이 있으면 그것, 없으면 직선 어림. 사람마다 exact(모든 구간을 잼)
drop function public.meetup_area_scores(uuid, int);
create function public.meetup_area_scores(p_meetup uuid, p_limit int default 10)
returns table (name text, lat double precision, lng double precision, people jsonb, max_minutes int, avg_minutes int, recent int, station_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  if (select count(distinct user_id) from public.meetup_points where meetup_id = p_meetup) < 2 then return; end if;
  return query
  with legs as (
    select a.name, a.lat, a.lng, a.station_name, mp.user_id, mp.kind,
           public.straight_minutes(mp.lat, mp.lng, a.lat, a.lng) as straight,
           tl.minutes as transit, tl.status as t_status, public.walk_only(mp.lat, mp.lng, a.lat, a.lng) as walk
    from public.meetup_areas a cross join public.meetup_points mp
    left join public.transit_legs tl
      on (mp.kind = 'origin' and tl.from_cell = public.geo_cell(mp.lat, mp.lng, 2) and tl.to_cell = public.geo_cell(a.lat, a.lng, 3))
      or (mp.kind = 'return' and tl.from_cell = public.geo_cell(a.lat, a.lng, 3) and tl.to_cell = public.geo_cell(mp.lat, mp.lng, 2))
    where mp.meetup_id = p_meetup
  ),
  timed as (
    select l.*,
           case when l.t_status = 'ok' then l.transit::double precision else l.straight end as minutes,
           -- 잼: 대중교통 값이 있거나, 경로가 없다고 확인했거나(직선 그대로), 가까워 걸어서
           (l.t_status in ('ok', 'none') or l.walk) as exact
    from legs l
  ),
  per_user as (
    select t.name, t.lat, t.lng, t.station_name, t.user_id,
           avg(t.minutes) filter (where t.kind = 'origin') as go_m,
           max(t.minutes) filter (where t.kind = 'return') as return_m,
           bool_and(t.exact) as exact
    from timed t group by t.name, t.lat, t.lng, t.station_name, t.user_id
  ),
  per_area as (
    select pu.name, pu.lat, pu.lng, pu.station_name,
           jsonb_agg(jsonb_build_object(
             'id', pu.user_id, 'nickname', p.nickname, 'isMe', pu.user_id = (select auth.uid()),
             'minutes', round(coalesce(pu.go_m, pu.return_m))::int, 'return', round(pu.return_m)::int, 'exact', pu.exact
           ) order by coalesce(pu.go_m, pu.return_m) desc) as people,
           round(max(coalesce(pu.go_m, pu.return_m)))::int as max_m, round(avg(coalesce(pu.go_m, pu.return_m)))::int as avg_m
    from per_user pu join public.profiles p on p.id = pu.user_id
    group by pu.name, pu.lat, pu.lng, pu.station_name
  )
  select s.name, s.lat, s.lng, s.people, s.max_m, s.avg_m,
         (select count(*)::int from public.user_places up join public.places pl on pl.id = up.place_id
          where up.tier in ('three', 'two') and not up.sponsored and up.updated_at > now() - interval '30 days'
            and pl.lat between s.lat - 0.012 and s.lat + 0.012 and pl.lng between s.lng - 0.015 and s.lng + 0.015),
         s.station_name
  from per_area s
  order by s.max_m, s.avg_m
  limit greatest(1, least(p_limit, 10));
end;
$$;
revoke all on function public.meetup_area_scores(uuid, int) from public, anon;
grant execute on function public.meetup_area_scores(uuid, int) to authenticated;

-- 만날 곳 정하기 · 지우기 — 참여자만 · 진행 중인 약속만. 지역 이름은 실제 지역일 때만 (브라우저 값을 믿지 않음)
create function public.set_meet_point(p_meetup uuid, p_label text, p_lat double precision, p_lng double precision, p_area text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  if not exists (select 1 from public.meetups where id = p_meetup and status = 'open') then raise exception 'closed' using errcode = 'P0002'; end if;
  if p_label is null then
    update public.meetups set meet_label = null, meet_lat = null, meet_lng = null, meet_area = null where id = p_meetup;
    return;
  end if;
  if char_length(btrim(p_label)) not between 1 and 40 or p_lat not between 33 and 39 or p_lng not between 124 and 132 then
    raise exception 'invalid' using errcode = '22023';
  end if;
  if p_area is not null and not exists (select 1 from public.meetup_areas where name = p_area) then raise exception 'no area' using errcode = '22023'; end if;
  update public.meetups set meet_label = btrim(p_label), meet_lat = p_lat, meet_lng = p_lng, meet_area = p_area where id = p_meetup;
end
$$;
revoke all on function public.set_meet_point(uuid, text, double precision, double precision, text) from public, anon;
grant execute on function public.set_meet_point(uuid, text, double precision, double precision, text) to authenticated;
