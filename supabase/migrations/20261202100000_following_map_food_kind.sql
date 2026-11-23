-- 팔로잉 지도에 세부 업종(food_kind) — 사진 없는 곳의 기본 그림 (55)
-- 순서를 장소 id 로 고정 — 화면이 1000행씩 나눠 받을 때 겹치거나 빠지지 않게 (PostgREST max_rows 1000)
drop function public.following_map_places();
create function public.following_map_places()
returns table (
  place_id uuid, name text, lat double precision, lng double precision, address text, cuisine text,
  category_name text, available boolean, raters jsonb, my_tier public.tier, food_kind text
)
language sql stable security definer set search_path = '' as $$
  select pl.id, pl.name, pl.lat, pl.lng, pl.address, pl.cuisine, pl.category_name, pl.available,
         jsonb_agg(jsonb_build_object('userId', up.user_id, 'nickname', pr.nickname, 'tier', up.tier)
                   order by public.tier_score(up.tier) desc, up.updated_at desc),
         -- 내가 저장했으면 내 등급 (카드에 함께 표시)
         (select mine.tier from public.user_places mine where mine.user_id = (select auth.uid()) and mine.place_id = pl.id),
         pl.food_kind
  from public.follows f
  join public.user_places up on up.user_id = f.followee_id
  join public.places pl on pl.id = up.place_id
  join public.profiles pr on pr.id = up.user_id
  where f.follower_id = (select auth.uid())
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and not up.sponsored
    and public.can_view_rating(up.user_id, up.place_id)
  group by pl.id
  order by pl.id
  limit 3000
$$;
revoke execute on function public.following_map_places() from public, anon;
grant execute on function public.following_map_places() to authenticated;
