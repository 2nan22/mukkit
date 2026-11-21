-- 함께 방문한 기록 — 누구랑 갔는지 묶기만 한다. 등급 · 한 줄 평가는 각자의 user_places 그대로
-- 태그된 사용자는 수락해야 이름이 보이고, 피드 한 줄에는 '피드에 보이기'를 허용한 사람만 나온다

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  visited_on date,
  meetup_id uuid references public.meetups (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (created_by, place_id)
);
create index visits_place_idx on public.visits (place_id);

-- 사용자(user_id) 또는 마이슐랭을 안 쓰는 사람의 이름 메모(guest_name, 만든 사람만 봄)
create table public.visit_members (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.visits (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  guest_name text check (char_length(btrim(guest_name)) between 1 and 20),
  status text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  show_in_feed boolean not null default true,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check ((user_id is null) <> (guest_name is null)),
  check (user_id is not null or status = 'accepted'),
  unique (visit_id, user_id)
);
create index visit_members_user_idx on public.visit_members (user_id);

alter table public.visits enable row level security;
alter table public.visit_members enable row level security;

create function public.is_visit_creator(p_visit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.visits v where v.id = p_visit and v.created_by = (select auth.uid()));
$$;

create function public.is_visit_member(p_visit uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.visit_members m
    where m.visit_id = p_visit and m.user_id = (select auth.uid()) and m.status <> 'declined'
  );
$$;

create policy "방문은 만든 사람 · 태그된 사람이 봄" on public.visits for select to authenticated
  using (created_by = (select auth.uid()) or public.is_visit_member(id));
create policy "방문은 내가 저장한 장소에만 만듦" on public.visits for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.user_places up where up.user_id = (select auth.uid()) and up.place_id = visits.place_id)
  );
create policy "방문 날짜는 만든 사람이 고침" on public.visits for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy "방문은 만든 사람이 지움" on public.visits for delete to authenticated
  using (created_by = (select auth.uid()));
revoke update on public.visits from authenticated;
grant update (visited_on) on public.visits to authenticated;

-- 직접 읽기는 내 줄 · 내가 만든 방문만. 함께 간 사람 목록은 아래 함수로
create policy "태그는 본인 · 만든 사람이 봄" on public.visit_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_visit_creator(visit_id));
create policy "태그는 만든 사람이 넣음" on public.visit_members for insert to authenticated
  with check (
    public.is_visit_creator(visit_id)
    and ((user_id is null and status = 'accepted') or (user_id <> (select auth.uid()) and status = 'invited'))
  );
create policy "태그 빼기는 만든 사람 · 본인" on public.visit_members for delete to authenticated
  using (
    (public.is_visit_creator(visit_id) and user_id is distinct from (select auth.uid()))
    or (user_id = (select auth.uid()) and not public.is_visit_creator(visit_id))
  );

-- 만든 사람은 처음부터 함께 간 사람(수락)
create function public.add_visit_creator() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.visit_members (visit_id, user_id, status, responded_at) values (new.id, new.created_by, 'accepted', now());
  return new;
end;
$$;
create trigger visits_add_creator after insert on public.visits for each row execute function public.add_visit_creator();

-- 태그 수락 · 거절 — 수락하면 그 장소가 내 저장 목록에 들어온다(평가 전). 내 등급은 평가 화면에서 따로
create function public.respond_visit(p_visit uuid, p_accept boolean, p_show_in_feed boolean default true)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  v public.visits;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into v from public.visits where id = p_visit;
  if not found or not exists (
    select 1 from public.visit_members m where m.visit_id = p_visit and m.user_id = me and m.status = 'invited'
  ) then
    raise exception 'no pending tag' using errcode = 'P0002';
  end if;
  update public.visit_members
    set status = case when p_accept then 'accepted' else 'declined' end,
        show_in_feed = p_show_in_feed, responded_at = now()
    where visit_id = p_visit and user_id = me;
  if p_accept then
    insert into public.user_places (user_id, place_id, visited_on) values (me, v.place_id, v.visited_on)
    on conflict (user_id, place_id) do nothing;
  end if;
  return v.place_id;
end;
$$;

-- 피드에 보이기 — 내 줄만
create function public.set_visit_feed(p_visit uuid, p_show boolean) returns void
language sql security definer set search_path = '' as $$
  update public.visit_members set show_in_feed = p_show
  where visit_id = p_visit and user_id = (select auth.uid()) and status = 'accepted';
$$;

-- 이 사람이 이 장소에 함께 간 사람들 — 남에게는 평가를 볼 수 있는 수락한 사용자만, 피드는 둘 다 허용했을 때만
create function public.visit_companions(p_owner uuid, p_place uuid, p_feed boolean default false)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(distinct jsonb_build_object('id', p.id, 'nickname', p.nickname)), '[]'::jsonb)
  from public.visits v
  join public.visit_members mo on mo.visit_id = v.id and mo.user_id = p_owner and mo.status = 'accepted'
  join public.visit_members mm on mm.visit_id = v.id and mm.user_id is not null and mm.user_id <> p_owner and mm.status = 'accepted'
  join public.profiles p on p.id = mm.user_id
  where v.place_id = p_place
    and public.can_view_rating(p_owner, p_place)
    and public.can_view_rating(mm.user_id, p_place)
    and (not p_feed or (mo.show_in_feed and mm.show_in_feed));
$$;

-- 이 장소에서 내가 들어간 방문 — 만든 사람은 모든 태그(이름 메모 포함), 태그된 사람은 만든 사람과 수락한 사람만
create function public.my_visits(p_place uuid)
returns table (
  visit_id uuid, is_creator boolean, creator_nickname text, visited_on date, meetup_id uuid,
  my_status text, my_show_in_feed boolean, members jsonb
)
language sql stable security definer set search_path = '' as $$
  select v.id, v.created_by = (select auth.uid()), cp.nickname, v.visited_on, v.meetup_id,
         me.status, me.show_in_feed,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'id', m.id, 'userId', m.user_id, 'nickname', coalesce(p.nickname, m.guest_name), 'guest', m.user_id is null, 'status', m.status
           ) order by m.created_at)
           from public.visit_members m
           left join public.profiles p on p.id = m.user_id
           where m.visit_id = v.id and m.user_id is distinct from (select auth.uid())
             and (v.created_by = (select auth.uid()) or (m.user_id is not null and m.status = 'accepted'))
         ), '[]'::jsonb)
  from public.visits v
  join public.visit_members me on me.visit_id = v.id and me.user_id = (select auth.uid()) and me.status <> 'declined'
  join public.profiles cp on cp.id = v.created_by
  where v.place_id = p_place
  order by v.created_by = (select auth.uid()) desc, v.created_at desc;
$$;

-- 받은 태그 (수락 대기)
create function public.received_visit_tags()
returns table (visit_id uuid, place_id uuid, place_name text, creator_id uuid, creator_nickname text, visited_on date, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select v.id, pl.id, pl.name, cp.id, cp.nickname, v.visited_on, m.created_at
  from public.visit_members m
  join public.visits v on v.id = m.visit_id
  join public.places pl on pl.id = v.place_id
  join public.profiles cp on cp.id = v.created_by
  where m.user_id = (select auth.uid()) and m.status = 'invited'
  order by m.created_at desc;
$$;

revoke all on function public.respond_visit(uuid, boolean, boolean) from public, anon;
revoke all on function public.set_visit_feed(uuid, boolean) from public, anon;
revoke all on function public.my_visits(uuid) from public, anon;
revoke all on function public.received_visit_tags() from public, anon;
revoke all on function public.visit_companions(uuid, uuid, boolean) from public;
grant execute on function public.respond_visit(uuid, boolean, boolean) to authenticated;
grant execute on function public.set_visit_feed(uuid, boolean) to authenticated;
grant execute on function public.my_visits(uuid) to authenticated;
grant execute on function public.received_visit_tags() to authenticated;
grant execute on function public.visit_companions(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.is_visit_creator(uuid) to authenticated;
grant execute on function public.is_visit_member(uuid) to authenticated;

-- 피드 · 프로필 · 장소 상세의 평가에 '함께 간 사람' 붙이기 (반환 칸이 늘어 다시 만든다)
drop function public.feed(timestamptz, int);
create function public.feed(p_before timestamptz default null, p_limit int default 20)
returns table (
  owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text,
  tier public.tier, review text, media jsonb, updated_at timestamptz, companions jsonb
)
language sql stable security definer set search_path = '' as $$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine,
         up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, true)
  from public.follows f
  join public.user_places up on up.user_id = f.followee_id
  join public.profiles pr on pr.id = up.user_id
  join public.places pl on pl.id = up.place_id
  where f.follower_id = (select auth.uid())
    and up.visibility in ('public', 'followers')
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and (p_before is null or up.updated_at < p_before)
  order by up.updated_at desc
  limit least(p_limit, 50)
$$;

drop function public.profile_ratings(uuid, int);
create function public.profile_ratings(p_owner uuid, p_limit int default 60)
returns table (
  place_id uuid, place_name text, address text, cuisine text, tier public.tier, review text, media jsonb, updated_at timestamptz,
  companions jsonb
)
language sql stable security definer set search_path = '' as $$
  select pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, false)
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  where up.user_id = p_owner
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(up.user_id, up.place_id)
  order by up.updated_at desc
  limit least(p_limit, 200)
$$;

revoke all on function public.feed(timestamptz, int) from public;
revoke all on function public.profile_ratings(uuid, int) from public;
grant execute on function public.feed(timestamptz, int) to authenticated;
grant execute on function public.profile_ratings(uuid, int) to anon, authenticated;

drop function public.place_ratings(uuid);
create function public.place_ratings(p_place uuid)
returns table (
  user_id uuid, nickname text, followed boolean, tier public.tier, review text, visited_on date,
  sponsored boolean, media jsonb, rated_count int, three_ratio int, updated_at timestamptz, companions jsonb
)
language sql stable security definer set search_path = '' as $$
  select up.user_id, pr.nickname,
         exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = up.user_id),
         up.tier, up.review, up.visited_on, up.sponsored,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         s.three + s.two + s.one + s.not_recommended,
         coalesce(round(100.0 * s.three / nullif(s.three + s.two + s.one + s.not_recommended, 0))::int, 0),
         up.updated_at,
         public.visit_companions(up.user_id, up.place_id, false)
  from public.user_places up
  join public.profiles pr on pr.id = up.user_id
  cross join lateral public.profile_stats(up.user_id) s
  where up.place_id = p_place
    and up.user_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000')
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(up.user_id, up.place_id)
  order by 3 desc, public.tier_score(up.tier) desc, up.updated_at desc
  limit 50
$$;
revoke all on function public.place_ratings(uuid) from public;
grant execute on function public.place_ratings(uuid) to anon, authenticated;
