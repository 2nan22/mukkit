-- 취향 겹침 · 프로필 통계 — 볼 수 있는 평가만, 협찬 표시 평가는 빼고
create function public.tier_score(t public.tier) returns int language sql immutable as $$
  select case t when 'three' then 3 when 'two' then 2 when 'one' then 1 when 'not_recommended' then 0 end
$$;

-- 나와 한 사람의 겹침: 둘 다 평가한 곳 수 · 둘 다 3스타 · 비슷함(0~1)
create function public.taste_with(p_other uuid)
returns table (overlap int, both_three int, similarity numeric)
language sql stable security definer set search_path = '' as $$
  select count(*)::int,
         count(*) filter (where mine.tier = 'three' and theirs.tier = 'three')::int,
         round(avg(1 - abs(public.tier_score(mine.tier) - public.tier_score(theirs.tier)) / 3.0), 3)
  from public.user_places mine
  join public.user_places theirs on theirs.place_id = mine.place_id and theirs.user_id = p_other
  where mine.user_id = (select auth.uid())
    and p_other <> (select auth.uid())
    and mine.tier in ('three', 'two', 'one', 'not_recommended') and not mine.sponsored
    and theirs.tier in ('three', 'two', 'one', 'not_recommended') and not theirs.sponsored
    and public.can_view_rating(theirs.user_id, theirs.place_id)
$$;

-- 아직 팔로우하지 않은, 취향이 비슷한 사람 — 겹침 2곳 이상
create function public.taste_matches(p_limit int default 10)
returns table (user_id uuid, nickname text, overlap int, both_three int, similarity numeric)
language sql stable security definer set search_path = '' as $$
  with pairs as (
    select theirs.user_id,
           count(*) as overlap,
           count(*) filter (where mine.tier = 'three' and theirs.tier = 'three') as both_three,
           avg(1 - abs(public.tier_score(mine.tier) - public.tier_score(theirs.tier)) / 3.0) as similarity
    from public.user_places mine
    join public.user_places theirs on theirs.place_id = mine.place_id and theirs.user_id <> mine.user_id
    where mine.user_id = (select auth.uid())
      and mine.tier in ('three', 'two', 'one', 'not_recommended') and not mine.sponsored
      and theirs.tier in ('three', 'two', 'one', 'not_recommended') and not theirs.sponsored
      and public.can_view_rating(theirs.user_id, theirs.place_id)
      and not exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = theirs.user_id)
    group by theirs.user_id
    having count(*) >= 2
  )
  select p.user_id, pr.nickname, p.overlap::int, p.both_three::int, round(p.similarity, 3)
  from pairs p join public.profiles pr on pr.id = p.user_id
  order by p.similarity * ln(p.overlap + 1) desc, p.overlap desc
  limit least(p_limit, 30)
$$;

-- 한 사람의 볼 수 있는 평가 통계 — 등급별 수 · 협찬 수
create function public.profile_stats(p_owner uuid)
returns table (three int, two int, one int, not_recommended int, sponsored int)
language sql stable security definer set search_path = '' as $$
  select count(*) filter (where tier = 'three' and not sponsored)::int,
         count(*) filter (where tier = 'two' and not sponsored)::int,
         count(*) filter (where tier = 'one' and not sponsored)::int,
         count(*) filter (where tier = 'not_recommended' and not sponsored)::int,
         count(*) filter (where sponsored)::int
  from public.user_places
  where user_id = p_owner
    and tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(user_id, place_id)
$$;

-- 한 사람의 공개 리스트 (링크 공유는 목록에 안 보인다)
create function public.profile_lists(p_owner uuid)
returns table (id uuid, name text, count int, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, (select count(*)::int from public.list_items li where li.list_id = l.id), l.updated_at
  from public.lists l
  where l.owner_id = p_owner and l.visibility = 'public'
  order by l.updated_at desc
$$;

revoke all on function public.taste_with(uuid) from public;
revoke all on function public.taste_matches(int) from public;
revoke all on function public.profile_stats(uuid) from public;
revoke all on function public.profile_lists(uuid) from public;
grant execute on function public.taste_with(uuid) to authenticated;
grant execute on function public.taste_matches(int) to authenticated;
grant execute on function public.profile_stats(uuid) to anon, authenticated;
grant execute on function public.profile_lists(uuid) to anon, authenticated;
