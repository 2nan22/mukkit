-- 먹은 메뉴 (선택) — 각자 자기 평가에 남긴다. 공개 범위는 평가를 따른다
alter table public.user_places
  add column menus text[] not null default '{}'
    check (cardinality(menus) <= 10 and char_length(array_to_string(menus, '')) <= 400);

drop function public.feed(timestamptz, int);
create function public.feed(p_before timestamptz default null, p_limit int default 20)
returns table (
  owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text,
  tier public.tier, review text, media jsonb, updated_at timestamptz, companions jsonb, menus text[]
)
language sql stable security definer set search_path = '' as $$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine,
         up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, true),
         up.menus
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
  companions jsonb, menus text[]
)
language sql stable security definer set search_path = '' as $$
  select pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, false),
         up.menus
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  where up.user_id = p_owner
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(up.user_id, up.place_id)
  order by up.updated_at desc
  limit least(p_limit, 200)
$$;

drop function public.place_ratings(uuid);
create function public.place_ratings(p_place uuid)
returns table (
  user_id uuid, nickname text, followed boolean, tier public.tier, review text, visited_on date,
  sponsored boolean, media jsonb, rated_count int, three_ratio int, updated_at timestamptz, companions jsonb, menus text[]
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
         public.visit_companions(up.user_id, up.place_id, false),
         up.menus
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

revoke all on function public.feed(timestamptz, int) from public;
revoke all on function public.profile_ratings(uuid, int) from public;
revoke all on function public.place_ratings(uuid) from public;
grant execute on function public.feed(timestamptz, int) to authenticated;
grant execute on function public.profile_ratings(uuid, int) to anon, authenticated;
grant execute on function public.place_ratings(uuid) to anon, authenticated;

-- 이미 있던 방문을 끝낸 약속에 이어 붙일 수 있게 — 약속 연결 · 차수(1차 · 2차)도 만든 사람이 고침
alter table public.visits add column meetup_seq smallint check (meetup_seq between 1 and 20);
grant update (meetup_id, meetup_seq) on public.visits to authenticated;
