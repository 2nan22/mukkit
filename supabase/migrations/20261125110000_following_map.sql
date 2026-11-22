-- 팔로잉 지도 (22) — 내가 팔로우하는 사람이 평가한 곳
-- 장소마다 누가 어떤 등급을 줬는지만 (평균 · 점수 없음). 핀 색은 그중 가장 높은 등급 = 실제 누군가의 평가
-- 볼 수 있는 평가만(can_view_rating) · 협찬 표시 평가는 빼고 (통계 · 추천과 같은 규칙)
create function public.following_map_places()
returns table (
  place_id uuid, name text, lat double precision, lng double precision, address text, cuisine text,
  category_name text, available boolean, raters jsonb
)
language sql stable security definer set search_path = '' as $$
  select pl.id, pl.name, pl.lat, pl.lng, pl.address, pl.cuisine, pl.category_name, pl.available,
         jsonb_agg(jsonb_build_object('userId', up.user_id, 'nickname', pr.nickname, 'tier', up.tier)
                   order by public.tier_score(up.tier) desc, up.updated_at desc)
  from public.follows f
  join public.user_places up on up.user_id = f.followee_id
  join public.places pl on pl.id = up.place_id
  join public.profiles pr on pr.id = up.user_id
  where f.follower_id = (select auth.uid())
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and not up.sponsored
    and public.can_view_rating(up.user_id, up.place_id)
  group by pl.id
  limit 3000
$$;
revoke execute on function public.following_map_places() from public, anon;
grant execute on function public.following_map_places() to authenticated;
