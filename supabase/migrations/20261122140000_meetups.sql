-- 약속 잡기 — 링크로 초대, 각자 출발지 · 귀가지(동 단위)로 둘에게 좋은 지역 찾기
-- 위치는 본인만 읽는다. 상대 위치는 점수 함수 안에서만 쓰고 '약 몇 분'만 돌려준다

create table public.meetups (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  guest_id uuid references public.profiles (id) on delete set null,
  purpose text not null check (purpose in ('meal', 'team', 'date', 'drinks', 'cafe')),
  invite_token text not null unique default encode(extensions.gen_random_bytes(12), 'hex'),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  check (guest_id is null or guest_id <> host_id)
);
create index meetups_host_idx on public.meetups (host_id);
create index meetups_guest_idx on public.meetups (guest_id);

create table public.meetup_points (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('origin', 'return')),
  label text not null check (char_length(label) between 1 and 40),
  lat double precision not null check (lat between 33 and 39),
  lng double precision not null check (lng between 124 and 132),
  updated_at timestamptz not null default now(),
  primary key (meetup_id, user_id, kind)
);

-- 저장 전에 약 1km 단위로 깎는다 — 정확한 집 위치가 남지 않게
create function public.round_meetup_point() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.lat := round(new.lat::numeric, 2);
  new.lng := round(new.lng::numeric, 2);
  new.updated_at := now();
  return new;
end;
$$;
create trigger meetup_points_round before insert or update on public.meetup_points
  for each row execute function public.round_meetup_point();

-- 약속 후보 지역 — 공개 정보(역 · 상권 이름과 좌표)
create table public.meetup_areas (
  name text primary key,
  lat double precision not null,
  lng double precision not null
);

alter table public.meetups enable row level security;
alter table public.meetup_points enable row level security;
alter table public.meetup_areas enable row level security;

create function public.is_meetup_member(p_meetup uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.meetups m
    where m.id = p_meetup and (select auth.uid()) in (m.host_id, m.guest_id)
  );
$$;

create policy "약속은 당사자만 봄" on public.meetups for select to authenticated
  using ((select auth.uid()) in (host_id, guest_id));
create policy "약속은 본인이 만듦" on public.meetups for insert to authenticated
  with check (host_id = (select auth.uid()) and guest_id is null);
create policy "약속 수정은 당사자만" on public.meetups for update to authenticated
  using ((select auth.uid()) in (host_id, guest_id))
  with check ((select auth.uid()) in (host_id, guest_id));
create policy "약속 삭제는 만든 사람만" on public.meetups for delete to authenticated
  using (host_id = (select auth.uid()));

create policy "위치는 본인 것만 봄" on public.meetup_points for select to authenticated
  using (user_id = (select auth.uid()));
create policy "위치는 당사자가 본인 것만 넣음" on public.meetup_points for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_meetup_member(meetup_id));
create policy "위치는 본인 것만 고침" on public.meetup_points for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_meetup_member(meetup_id));
create policy "위치는 본인 것만 지움" on public.meetup_points for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "후보 지역은 누구나 봄" on public.meetup_areas for select using (true);

-- 초대 링크 미리보기 — 참여 전에도 누가 · 무슨 약속인지만
create function public.meetup_invite(p_token text)
returns table (meetup_id uuid, host_nickname text, purpose text, status text, joined boolean, is_host boolean, full boolean)
language sql stable security definer set search_path = '' as $$
  select m.id, p.nickname, m.purpose, m.status,
         (select auth.uid()) = m.guest_id,
         (select auth.uid()) = m.host_id,
         m.guest_id is not null and (select auth.uid()) is distinct from m.guest_id
  from public.meetups m join public.profiles p on p.id = m.host_id
  where m.invite_token = p_token and m.expires_at > now();
$$;

-- 링크로 참여 — 자리가 비었고 만든 사람이 아니면 손님으로
create function public.join_meetup(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.meetups;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into m from public.meetups where invite_token = p_token and expires_at > now() and status = 'open' for update;
  if not found then raise exception 'meetup not found' using errcode = 'P0002'; end if;
  if m.host_id = me or m.guest_id = me then return m.id; end if;
  if m.guest_id is not null then raise exception 'meetup full' using errcode = 'P0001'; end if;
  update public.meetups set guest_id = me where id = m.id;
  return m.id;
end;
$$;

-- 두 사람에게 좋은 지역 — 각자 (출발지 → 지역) · (지역 → 귀가지) 이동을 직선거리로 어림해 평균
-- 더 먼 쪽을 줄이는 순(공평), 같으면 합이 작은 순. 상대 위치는 밖으로 내보내지 않는다
create function public.meetup_area_scores(p_meetup uuid, p_limit int default 3)
returns table (name text, lat double precision, lng double precision, my_minutes int, partner_minutes int, recent int)
language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  partner uuid;
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  select case when m.host_id = me then m.guest_id else m.host_id end into partner from public.meetups m where m.id = p_meetup;
  if partner is null then return; end if;
  return query
  with pts as (
    select mp.user_id, mp.lat, mp.lng from public.meetup_points mp where mp.meetup_id = p_meetup
  ),
  cost as (
    select a.name, a.lat, a.lng, pts.user_id,
           -- 시속 22km 어림 + 갈아타기 · 걷기 8분
           avg(2 * 6371 * asin(sqrt(power(sin(radians(a.lat - pts.lat) / 2), 2)
               + cos(radians(pts.lat)) * cos(radians(a.lat)) * power(sin(radians(a.lng - pts.lng) / 2), 2))) / 22 * 60 + 8) as minutes
    from public.meetup_areas a cross join pts
    group by a.name, a.lat, a.lng, pts.user_id
  ),
  both_sides as (
    select c1.name, c1.lat, c1.lng, round(c1.minutes)::int as my_m, round(c2.minutes)::int as partner_m
    from cost c1 join cost c2 on c2.name = c1.name and c2.user_id = partner
    where c1.user_id = me
  )
  select b.name, b.lat, b.lng, b.my_m, b.partner_m,
         (select count(*)::int from public.user_places up join public.places pl on pl.id = up.place_id
          where up.tier in ('three', 'two') and not up.sponsored and up.updated_at > now() - interval '30 days'
            and pl.lat between b.lat - 0.012 and b.lat + 0.012 and pl.lng between b.lng - 0.015 and b.lng + 0.015)
  from both_sides b
  order by greatest(b.my_m, b.partner_m), b.my_m + b.partner_m
  limit greatest(1, least(p_limit, 10));
end;
$$;

-- 끝났거나 지난 약속의 위치 기록 정리 — 새벽 크론(서비스 키)만
create function public.cleanup_meetup_points() returns int
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.meetup_points mp using public.meetups m
    where mp.meetup_id = m.id and (m.status <> 'open' or m.expires_at < now())
    returning 1
  )
  select count(*)::int from gone;
$$;

revoke all on function public.meetup_invite(text) from public;
revoke all on function public.join_meetup(text) from public, anon;
revoke all on function public.meetup_area_scores(uuid, int) from public, anon;
revoke all on function public.cleanup_meetup_points() from public, anon, authenticated;
grant execute on function public.meetup_invite(text) to anon, authenticated;
grant execute on function public.join_meetup(text) to authenticated;
grant execute on function public.meetup_area_scores(uuid, int) to authenticated;
grant execute on function public.is_meetup_member(uuid) to authenticated;

insert into public.meetup_areas (name, lat, lng) values
  ('강남역', 37.4979, 127.0276), ('신논현 · 교대', 37.4934, 127.0140), ('선릉 · 삼성', 37.5067, 127.0560),
  ('고속터미널', 37.5049, 127.0049), ('사당', 37.4766, 126.9816), ('신림', 37.4842, 126.9297),
  ('홍대입구', 37.5572, 126.9245), ('합정 · 망원', 37.5495, 126.9139), ('신촌', 37.5551, 126.9368),
  ('성수', 37.5446, 127.0559), ('건대입구', 37.5404, 127.0702), ('왕십리', 37.5612, 127.0371),
  ('을지로', 37.5663, 126.9917), ('종로 · 광화문', 37.5704, 126.9810), ('명동', 37.5609, 126.9863),
  ('혜화', 37.5822, 127.0019), ('서울역', 37.5547, 126.9707), ('용산 · 삼각지', 37.5298, 126.9648),
  ('이태원 · 한남', 37.5345, 126.9946), ('여의도', 37.5216, 126.9242), ('영등포', 37.5156, 126.9073),
  ('목동', 37.5245, 126.8752), ('구로디지털단지', 37.4852, 126.9015), ('잠실', 37.5133, 127.1001),
  ('노원', 37.6551, 127.0613), ('수유', 37.6381, 127.0257), ('판교', 37.3948, 127.1112),
  ('정자 · 서현', 37.3670, 127.1084), ('수원역', 37.2659, 127.0000), ('부평', 37.4895, 126.7245),
  ('일산 정발산', 37.6596, 126.7733), ('서면', 35.1579, 129.0597), ('해운대', 35.1631, 129.1636),
  ('동성로', 35.8694, 128.5961), ('둔산', 36.3518, 127.3785), ('충장로', 35.1490, 126.9156);
