-- 홈 시안: 추천 사람에 3스타 비율 · 새로 공개된 리스트(지도 미리보기용 점)
drop function public.taste_matches(int);
create function public.taste_matches(p_limit int default 10)
returns table (user_id uuid, nickname text, overlap int, both_three int, similarity numeric, three_ratio int)
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
  select p.user_id, pr.nickname, p.overlap::int, p.both_three::int, round(p.similarity, 3),
         coalesce(round(100.0 * s.three / nullif(s.three + s.two + s.one + s.not_recommended, 0))::int, 0)
  from pairs p
  join public.profiles pr on pr.id = p.user_id
  cross join lateral public.profile_stats(p.user_id) s
  order by p.similarity * ln(p.overlap + 1) desc, p.overlap desc
  limit least(p_limit, 30)
$$;
revoke all on function public.taste_matches(int) from public;
grant execute on function public.taste_matches(int) to authenticated;

-- 남이 새로 공개한 리스트 — 지도 미리보기 점(위경도 · 주인의 공개된 등급)까지
create function public.recent_public_lists(p_limit int default 6)
returns table (id uuid, name text, owner_nickname text, count int, points jsonb)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, pr.nickname,
         (select count(*)::int from public.list_items li where li.list_id = l.id),
         coalesce((
           select jsonb_agg(jsonb_build_object('lat', pl.lat, 'lng', pl.lng,
                    'tier', case when up.tier in ('three', 'two', 'one', 'not_recommended')
                                  and public.can_view_rating(up.user_id, up.place_id) then up.tier end))
           from (select place_id from public.list_items where list_id = l.id order by added_at desc limit 12) li
           join public.places pl on pl.id = li.place_id
           left join public.user_places up on up.user_id = l.owner_id and up.place_id = li.place_id
         ), '[]'::jsonb)
  from public.lists l
  join public.profiles pr on pr.id = l.owner_id
  where l.visibility = 'public' and l.owner_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000')
  order by l.updated_at desc
  limit least(p_limit, 20)
$$;
revoke all on function public.recent_public_lists(int) from public;
grant execute on function public.recent_public_lists(int) to anon, authenticated;
