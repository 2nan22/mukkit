-- 장소 상세의 남 평가 · 여기서 뭐 먹지 후보 — 볼 수 있는 평가만, 메모 없음, 협찬 표시는 따로
create function public.place_ratings(p_place uuid)
returns table (
  user_id uuid, nickname text, followed boolean, tier public.tier, review text, visited_on date,
  sponsored boolean, media jsonb, rated_count int, three_ratio int, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select up.user_id, pr.nickname,
         exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = up.user_id),
         up.tier, up.review, up.visited_on, up.sponsored,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         s.three + s.two + s.one + s.not_recommended,
         coalesce(round(100.0 * s.three / nullif(s.three + s.two + s.one + s.not_recommended, 0))::int, 0),
         up.updated_at
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

-- 반경 안 후보 — 내 상태 · 볼 수 있는 남의 2 · 3스타와 그 사람과 나의 비슷함
create function public.eat_candidates(p_lat double precision, p_lng double precision, p_radius_m double precision default 1000)
returns table (
  place_id uuid, name text, lat double precision, lng double precision, address text, cuisine text, category_name text,
  my_tier public.tier, raters jsonb
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  near as (
    select pl.* from public.places pl
    where pl.available
      and pl.lat between p_lat - p_radius_m / 111000 and p_lat + p_radius_m / 111000
      and pl.lng between p_lng - p_radius_m / 88000 and p_lng + p_radius_m / 88000
  ),
  others as (
    select up.place_id, up.user_id, up.tier
    from public.user_places up join near on near.id = up.place_id
    where up.user_id <> (select id from me)
      and up.tier in ('three', 'two') and not up.sponsored
      and public.can_view_rating(up.user_id, up.place_id)
  ),
  sims as (
    select theirs.user_id,
           count(*)::int as overlap,
           avg(1 - abs(public.tier_score(mine.tier) - public.tier_score(theirs.tier)) / 3.0) as similarity
    from public.user_places mine
    join public.user_places theirs on theirs.place_id = mine.place_id
    where mine.user_id = (select id from me)
      and theirs.user_id in (select distinct user_id from others)
      and mine.tier in ('three', 'two', 'one', 'not_recommended') and not mine.sponsored
      and theirs.tier in ('three', 'two', 'one', 'not_recommended') and not theirs.sponsored
      and public.can_view_rating(theirs.user_id, theirs.place_id)
    group by theirs.user_id
  )
  select near.id, near.name, near.lat, near.lng, near.address, near.cuisine, near.category_name,
         mine.tier,
         coalesce((
           select jsonb_agg(jsonb_build_object(
             'userId', o.user_id, 'nickname', pr.nickname, 'tier', o.tier,
             'followed', exists (select 1 from public.follows f where f.follower_id = (select id from me) and f.followee_id = o.user_id),
             'overlap', coalesce(s.overlap, 0), 'similarity', s.similarity))
           from others o join public.profiles pr on pr.id = o.user_id left join sims s on s.user_id = o.user_id
           where o.place_id = near.id
         ), '[]'::jsonb)
  from near
  left join public.user_places mine on mine.place_id = near.id and mine.user_id = (select id from me)
  where (mine.tier is null or mine.tier not in ('not_recommended', 'one'))
    and (mine.tier in ('want_to_go', 'three', 'two') or exists (select 1 from others o where o.place_id = near.id))
  limit 400
$$;

revoke all on function public.place_ratings(uuid) from public;
revoke all on function public.eat_candidates(double precision, double precision, double precision) from public;
grant execute on function public.place_ratings(uuid) to anon, authenticated;
grant execute on function public.eat_candidates(double precision, double precision, double precision) to authenticated;
