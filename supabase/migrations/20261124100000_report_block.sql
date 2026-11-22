-- 신고 · 차단
-- 차단: 서로의 평가 · 사진 · 리스트 · 함께 방문이 안 보이고, 팔로우는 풀리며, 약속 초대 · 함께 방문 태그를 서로 못 보낸다
-- 신고: 모두 기록. 서로 다른 3명이 신고한 평가(사진 포함)는 남에게 자동으로 숨긴다 (사용자 결정 2026-11-22)

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
create policy "차단은 내가 한 것만 봄" on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy "차단은 내가 함" on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "차단 해제는 내가 한 것만" on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));

-- 두 사람 사이에 어느 쪽이든 차단이 있나 (로그인 안 했으면 없음)
create function public.is_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_a is not null and p_b is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

-- 나와 서로 차단 사이인 사람들 — 사람 검색 · 초대 후보에서 뺀다 (누가 나를 막았는지는 구분해 알려 주지 않음)
create function public.my_block_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select case when b.blocker_id = (select auth.uid()) then b.blocked_id else b.blocker_id end
  from public.blocks b
  where b.blocker_id = (select auth.uid()) or b.blocked_id = (select auth.uid());
$$;

-- 차단하면 서로의 팔로우 · 대기 중인 약속 초대 · 함께 방문 요청을 정리
create function public.after_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
    where (follower_id = new.blocker_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.meetup_invites mi using public.meetups m
    where mi.meetup_id = m.id
      and ((m.host_id = new.blocker_id and mi.user_id = new.blocked_id) or (m.host_id = new.blocked_id and mi.user_id = new.blocker_id));
  delete from public.visit_members vm using public.visits v
    where vm.visit_id = v.id and vm.status = 'invited'
      and ((v.created_by = new.blocker_id and vm.user_id = new.blocked_id) or (v.created_by = new.blocked_id and vm.user_id = new.blocker_id));
  return new;
end;
$$;
create trigger blocks_after_insert after insert on public.blocks for each row execute function public.after_block();

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user uuid not null references public.profiles (id) on delete cascade,
  -- 장소가 있으면 그 사람의 그 장소 평가(사진 포함) 신고, 없으면 사람 신고
  target_place uuid references public.places (id) on delete cascade,
  reason text not null check (reason in ('ad', 'inappropriate', 'fake', 'harassment', 'other')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (reporter_id <> target_user)
);
create unique index reports_once_idx on public.reports (reporter_id, target_user, coalesce(target_place, '00000000-0000-0000-0000-000000000000'));
create index reports_target_idx on public.reports (target_user, target_place);
alter table public.reports enable row level security;
create policy "신고는 내가 함" on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "신고는 내가 한 것만 봄" on public.reports for select to authenticated using (reporter_id = (select auth.uid()));

-- 서로 다른 3명 이상이 신고한 평가
create function public.is_rating_hidden(p_owner uuid, p_place uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(distinct r.reporter_id) from public.reports r where r.target_user = p_owner and r.target_place = p_place) >= 3;
$$;

-- 보는 사람이 이 평가를 볼 수 있나 — 본인은 언제나, 남은 차단 · 신고 숨김이 아니고 공개 범위가 맞을 때
create or replace function public.can_view_rating(p_owner uuid, p_place uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_places up
    where up.user_id = p_owner and up.place_id = p_place
      and (
        up.user_id = (select auth.uid())
        or (
          not public.is_blocked((select auth.uid()), p_owner)
          and not public.is_rating_hidden(p_owner, p_place)
          and (
            up.visibility = 'public'
            or (up.visibility = 'followers' and exists (
              select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = p_owner))
          )
        )
      )
  )
$$;

create or replace function public.public_list(p_list_id uuid)
returns table (
  list_name text,
  description text,
  visibility public.list_visibility,
  owner_nickname text,
  place_id uuid,
  name text,
  lat double precision,
  lng double precision,
  address text,
  cuisine text,
  category_name text,
  tier public.tier,
  added_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select l.name, l.description, l.visibility, pr.nickname,
         pl.id, pl.name, pl.lat, pl.lng, pl.address, pl.cuisine, pl.category_name,
         case when up.tier in ('three', 'two', 'one', 'not_recommended') then up.tier end,
         li.added_at
  from public.lists l
  join public.profiles pr on pr.id = l.owner_id
  left join public.list_items li on li.list_id = l.id
  left join public.places pl on pl.id = li.place_id
  left join public.user_places up on up.user_id = l.owner_id and up.place_id = li.place_id
  where l.id = p_list_id and l.visibility in ('link', 'public')
    and not public.is_blocked((select auth.uid()), l.owner_id)
  order by li.added_at desc nulls last
$$;

create or replace function public.recent_public_lists(p_limit int default 6)
returns table (id uuid, name text, owner_nickname text, count int, points jsonb)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, pr.nickname,
         (select count(*)::int from public.list_items li where li.list_id = l.id),
         coalesce((
           select jsonb_agg(jsonb_build_object('placeId', pl.id, 'cuisine', pl.cuisine, 'lat', pl.lat, 'lng', pl.lng,
                    'tier', case when up.tier in ('three', 'two', 'one', 'not_recommended')
                                  and public.can_view_rating(up.user_id, up.place_id) then up.tier end))
           from (select place_id from public.list_items where list_id = l.id order by added_at desc limit 12) li
           join public.places pl on pl.id = li.place_id
           left join public.user_places up on up.user_id = l.owner_id and up.place_id = li.place_id
         ), '[]'::jsonb)
  from public.lists l
  join public.profiles pr on pr.id = l.owner_id
  where l.visibility = 'public' and l.owner_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000')
    and not public.is_blocked((select auth.uid()), l.owner_id)
  order by l.updated_at desc
  limit least(p_limit, 20)
$$;

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
  -- 만든 사람과 서로 차단한 사이면 참여 불가
  if public.is_blocked(me, m.host_id) then raise exception 'blocked' using errcode = '42501'; end if;
  if (select count(*) from public.meetup_members where meetup_id = m.id) >= m.max_members then
    raise exception 'meetup full' using errcode = 'P0001';
  end if;
  insert into public.meetup_members (meetup_id, user_id) values (m.id, me);
  delete from public.meetup_invites where meetup_id = m.id and user_id = me;
  return m.id;
end;
$$;

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
  if public.is_blocked(me, p_user) then raise exception 'blocked' using errcode = '42501'; end if;
  if exists (select 1 from public.meetup_members where meetup_id = p_meetup and user_id = p_user) then return; end if;
  insert into public.meetup_invites (meetup_id, user_id) values (p_meetup, p_user) on conflict do nothing;
end;
$$;

-- 함께 방문 태그도 차단한 사이엔 못 넣음
drop policy "태그는 만든 사람이 넣음" on public.visit_members;
create policy "태그는 만든 사람이 넣음" on public.visit_members for insert to authenticated
  with check (
    public.is_visit_creator(visit_id)
    and ((user_id is null and status = 'accepted') or (user_id <> (select auth.uid()) and status = 'invited' and not public.is_blocked((select auth.uid()), user_id)))
  );

-- 팔로우도 차단한 사이엔 못 함
create policy "차단한 사이엔 팔로우 못 함" on public.follows as restrictive for insert to authenticated
  with check (not public.is_blocked(follower_id, followee_id));

revoke all on function public.is_blocked(uuid, uuid) from public;
revoke all on function public.my_block_ids() from public, anon;
revoke all on function public.is_rating_hidden(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to anon, authenticated;
grant execute on function public.my_block_ids() to authenticated;
grant execute on function public.is_rating_hidden(uuid, uuid) to anon, authenticated;
