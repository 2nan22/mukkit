-- 여러 명 약속 — 손님 한 칸 대신 참여자 목록(최대 8명) · 받은 초대 목록
-- 위치는 여전히 본인만 읽고, 점수는 함수 안에서만 계산해 사람별 '약 N분'만 돌려준다

alter table public.meetups
  add column max_members int not null default 8 check (max_members between 2 and 8);

create table public.meetup_members (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create index meetup_members_user_idx on public.meetup_members (user_id);

create table public.meetup_invites (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (meetup_id, user_id)
);
create index meetup_invites_user_idx on public.meetup_invites (user_id);

-- 기존 약속 옮기기
insert into public.meetup_members (meetup_id, user_id, joined_at) select id, host_id, created_at from public.meetups;
insert into public.meetup_members (meetup_id, user_id) select id, guest_id from public.meetups where guest_id is not null on conflict do nothing;
insert into public.meetup_invites (meetup_id, user_id) select id, invitee_id from public.meetups where invitee_id is not null on conflict do nothing;

-- 약속을 만들면 만든 사람이 첫 참여자
create function public.add_meetup_host() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.meetup_members (meetup_id, user_id) values (new.id, new.host_id);
  return new;
end;
$$;
create trigger meetups_add_host after insert on public.meetups for each row execute function public.add_meetup_host();

-- 참여자인지 — 위치 넣기 · 점수 계산의 문
create or replace function public.is_meetup_member(p_meetup uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.meetup_members where meetup_id = p_meetup and user_id = (select auth.uid()));
$$;

create function public.is_meetup_invitee(p_meetup uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.meetup_invites where meetup_id = p_meetup and user_id = (select auth.uid()));
$$;

drop policy "약속은 당사자 · 초대받은 사람만 봄" on public.meetups;
drop policy "약속 수정은 당사자만" on public.meetups;
create policy "약속은 참여자 · 초대받은 사람만 봄" on public.meetups for select to authenticated
  using (host_id = (select auth.uid()) or public.is_meetup_member(id) or public.is_meetup_invitee(id));
create policy "약속 수정은 참여자만" on public.meetups for update to authenticated
  using (public.is_meetup_member(id)) with check (public.is_meetup_member(id));

alter table public.meetup_members enable row level security;
alter table public.meetup_invites enable row level security;
create policy "참여자 목록은 참여자만 봄" on public.meetup_members for select to authenticated using (public.is_meetup_member(meetup_id));
create policy "참여자는 스스로 나갈 수 있음" on public.meetup_members for delete to authenticated
  using (user_id = (select auth.uid()) and not exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = (select auth.uid())));
create policy "초대는 받은 사람 · 만든 사람만 봄" on public.meetup_invites for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.meetups m where m.id = meetup_id and m.host_id = (select auth.uid())));

-- 링크로 참여 — 자리가 남아 있으면
create or replace function public.join_meetup(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.meetups;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into m from public.meetups where invite_token = p_token and expires_at > now() and status = 'open' for update;
  if not found then raise exception 'meetup not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.meetup_members where meetup_id = m.id and user_id = me) then return m.id; end if;
  if (select count(*) from public.meetup_members where meetup_id = m.id) >= m.max_members then
    raise exception 'meetup full' using errcode = 'P0001';
  end if;
  insert into public.meetup_members (meetup_id, user_id) values (m.id, me);
  delete from public.meetup_invites where meetup_id = m.id and user_id = me;
  return m.id;
end;
$$;

-- 만든 사람이 사용자를 초대 — 여러 명 가능
create or replace function public.invite_to_meetup(p_meetup uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.meetups where id = p_meetup and host_id = me and status = 'open' and expires_at > now()) then
    raise exception 'cannot invite' using errcode = '42501';
  end if;
  if p_user = me or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'bad invitee' using errcode = '22023';
  end if;
  if exists (select 1 from public.meetup_members where meetup_id = p_meetup and user_id = p_user) then return; end if;
  insert into public.meetup_invites (meetup_id, user_id) values (p_meetup, p_user) on conflict do nothing;
end;
$$;

create or replace function public.respond_meetup_invite(p_meetup uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.meetups;
begin
  if not exists (select 1 from public.meetup_invites where meetup_id = p_meetup and user_id = me) then
    raise exception 'not invited' using errcode = '42501';
  end if;
  delete from public.meetup_invites where meetup_id = p_meetup and user_id = me;
  if not p_accept then return; end if;
  select * into m from public.meetups where id = p_meetup and status = 'open' and expires_at > now() for update;
  if not found or (select count(*) from public.meetup_members where meetup_id = p_meetup) >= m.max_members then
    raise exception 'meetup full' using errcode = 'P0001';
  end if;
  insert into public.meetup_members (meetup_id, user_id) values (p_meetup, me) on conflict do nothing;
end;
$$;

-- 이제 손님 · 초대 칸을 쓰는 함수 · 정책을 모두 바꿨으니 칸을 지운다
drop function public.meetup_status(uuid);
drop function public.meetup_area_scores(uuid, int);
drop function public.meetup_invite(text);
drop policy "위치는 당사자가 본인 것만 넣음" on public.meetup_points;
drop policy "위치는 본인 것만 고침" on public.meetup_points;
create policy "위치는 참여자가 본인 것만 넣음" on public.meetup_points for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_meetup_member(meetup_id));
create policy "위치는 본인 것만 고침" on public.meetup_points for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_meetup_member(meetup_id));
drop policy "약속은 본인이 만듦" on public.meetups;
create policy "약속은 본인이 만듦" on public.meetups for insert to authenticated
  with check (host_id = (select auth.uid()));
alter table public.meetups drop constraint meetups_invitee_not_host;
alter table public.meetups drop column guest_id, drop column invitee_id;
grant update (purpose, starts_at, ends_at, status) on public.meetups to authenticated;

-- 약속 상태 — 참여자 이름 · 입력 여부(위치 값은 숨김), 받은 초대 이름은 만든 사람에게만
create function public.meetup_status(p_meetup uuid)
returns table (
  meetup_id uuid, purpose text, status text, invite_token text, expires_at timestamptz, starts_at timestamptz, ends_at timestamptz,
  max_members int, is_host boolean, is_member boolean, is_invitee boolean, host_nickname text, me_ready boolean,
  members jsonb, invitees jsonb
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  m as (
    select * from public.meetups mt
    where mt.id = p_meetup
      and (exists (select 1 from public.meetup_members mm where mm.meetup_id = mt.id and mm.user_id = (select id from me))
           or exists (select 1 from public.meetup_invites mi where mi.meetup_id = mt.id and mi.user_id = (select id from me)))
  )
  select m.id, m.purpose, m.status,
         case when m.host_id = (select id from me) then m.invite_token end,
         m.expires_at, m.starts_at, m.ends_at, m.max_members,
         m.host_id = (select id from me),
         exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select id from me)),
         exists (select 1 from public.meetup_invites mi where mi.meetup_id = m.id and mi.user_id = (select id from me)),
         (select p.nickname from public.profiles p where p.id = m.host_id),
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = (select id from me)),
         -- 참여자 목록은 참여자에게만
         case when exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select id from me)) then
           (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id, 'nickname', p.nickname, 'isHost', p.id = m.host_id, 'isMe', p.id = (select id from me),
              'ready', exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = p.id)
            ) order by mm.joined_at), '[]'::jsonb)
            from public.meetup_members mm join public.profiles p on p.id = mm.user_id where mm.meetup_id = m.id)
         else '[]'::jsonb end,
         case when m.host_id = (select id from me) then
           (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname) order by mi.created_at), '[]'::jsonb)
            from public.meetup_invites mi join public.profiles p on p.id = mi.user_id where mi.meetup_id = m.id)
         else '[]'::jsonb end
  from m;
$$;

-- 여러 사람에게 좋은 지역 — 위치를 넣은 참여자 2명 이상일 때, 가장 먼 사람의 시간이 짧은 순 · 그다음 평균
create function public.meetup_area_scores(p_meetup uuid, p_limit int default 10)
returns table (name text, lat double precision, lng double precision, people jsonb, max_minutes int, avg_minutes int, recent int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  if (select count(distinct user_id) from public.meetup_points where meetup_id = p_meetup) < 2 then return; end if;
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
    select l.name, l.lat, l.lng, l.user_id, avg(l.minutes) as avg_m, max(l.minutes) filter (where l.kind = 'return') as return_m
    from legs l group by l.name, l.lat, l.lng, l.user_id
  ),
  per_area as (
    select pu.name, pu.lat, pu.lng,
           jsonb_agg(jsonb_build_object(
             'id', pu.user_id, 'nickname', p.nickname, 'isMe', pu.user_id = (select auth.uid()),
             'minutes', round(pu.avg_m)::int, 'return', round(pu.return_m)::int
           ) order by pu.avg_m desc) as people,
           round(max(pu.avg_m))::int as max_m, round(avg(pu.avg_m))::int as avg_m
    from per_user pu join public.profiles p on p.id = pu.user_id
    group by pu.name, pu.lat, pu.lng
  )
  select s.name, s.lat, s.lng, s.people, s.max_m, s.avg_m,
         (select count(*)::int from public.user_places up join public.places pl on pl.id = up.place_id
          where up.tier in ('three', 'two') and not up.sponsored and up.updated_at > now() - interval '30 days'
            and pl.lat between s.lat - 0.012 and s.lat + 0.012 and pl.lng between s.lng - 0.015 and s.lng + 0.015)
  from per_area s
  order by s.max_m, s.avg_m
  limit greatest(1, least(p_limit, 10));
end;
$$;

-- 초대 링크 미리보기
create function public.meetup_invite(p_token text)
returns table (meetup_id uuid, host_nickname text, purpose text, status text, starts_at timestamptz, ends_at timestamptz,
               member_count int, joined boolean, is_host boolean, full boolean)
language sql stable security definer set search_path = '' as $$
  select m.id, p.nickname, m.purpose, m.status, m.starts_at, m.ends_at,
         (select count(*)::int from public.meetup_members mm where mm.meetup_id = m.id),
         exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select auth.uid())),
         (select auth.uid()) = m.host_id,
         (select count(*) from public.meetup_members mm where mm.meetup_id = m.id) >= m.max_members
           and not exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select auth.uid()))
  from public.meetups m join public.profiles p on p.id = m.host_id
  where m.invite_token = p_token and m.expires_at > now();
$$;

revoke all on function public.meetup_status(uuid) from public, anon;
revoke all on function public.meetup_area_scores(uuid, int) from public, anon;
revoke all on function public.meetup_invite(text) from public;
revoke all on function public.is_meetup_invitee(uuid) from public, anon;
grant execute on function public.meetup_status(uuid) to authenticated;
grant execute on function public.meetup_area_scores(uuid, int) to authenticated;
grant execute on function public.meetup_invite(text) to anon, authenticated;
grant execute on function public.is_meetup_invitee(uuid) to authenticated;
