-- 장소 대표 사진 — 사용자가 직접 올린 평가 사진만 (네이버 · 카카오 사진은 쓰지 않는다)
-- 장소마다 하나: 내 사진 → 팔로우하는 사람 → 그 밖에 볼 수 있는 평가, 같은 순위면 최근 것
-- 평가 공개 범위(can_view_rating)를 그대로 따른다 — 남의 '나만' 평가 사진은 고르지 않는다
-- 협찬 · 이벤트 표시 평가의 사진은 남에게 대표로 쓰지 않는다 (통계 · 추천과 같은 규칙)
create function public.place_covers(p_places uuid[])
returns table (place_id uuid, path text, owner_id uuid, owner_nickname text, mine boolean)
language sql stable security definer set search_path = '' as $$
  select distinct on (m.place_id)
         m.place_id, m.path, m.user_id, pr.nickname,
         coalesce(m.user_id = (select auth.uid()), false)
  from public.rating_media m
  join public.profiles pr on pr.id = m.user_id
  join public.user_places up on up.user_id = m.user_id and up.place_id = m.place_id
  where m.place_id = any (p_places[1:300])
    and (not up.sponsored or m.user_id = (select auth.uid()))
    and m.kind = 'image'
    and public.can_view_rating(m.user_id, m.place_id)
  order by m.place_id,
           coalesce(m.user_id = (select auth.uid()), false) desc,
           exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = m.user_id) desc,
           m.created_at desc
$$;

revoke all on function public.place_covers(uuid[]) from public;
grant execute on function public.place_covers(uuid[]) to anon, authenticated;
