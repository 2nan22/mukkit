-- 대표 사진에 모르는 사람의 공개 평가 사진도 쓴다 (사용자 결정 2026-11-22, 신고 · 차단 뒤)
-- 순서: 내 사진 → 팔로우하는 사람 → 볼 수 있는 다른 사람, 같은 순위면 최근 것
--   (좋아요가 생기면 다른 사람 사진은 좋아요 많은 순으로)
-- 모르는 사람 사진은 신고가 한 건이라도 있으면 대표로 쓰지 않는다 — 가게가 사진으로 대표를 차지하지 못하게
-- 공개 범위 · 차단 · 신고 숨김은 can_view_rating, 협찬 평가 사진 제외는 그대로
create or replace function public.place_covers(p_places uuid[])
returns table (place_id uuid, path text, owner_id uuid, owner_nickname text, mine boolean)
language sql stable security definer set search_path = '' as $$
  with c as (
    select m.place_id, m.path, m.user_id, pr.nickname, m.created_at,
           case
             when m.user_id = (select auth.uid()) then 0
             when exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = m.user_id) then 1
             else 2
           end as rank
    from public.rating_media m
    join public.profiles pr on pr.id = m.user_id
    join public.user_places up on up.user_id = m.user_id and up.place_id = m.place_id
    where m.place_id = any (p_places[1:300])
      and m.kind = 'image'
      and (not up.sponsored or m.user_id = (select auth.uid()))
      and public.can_view_rating(m.user_id, m.place_id)
  )
  select distinct on (c.place_id) c.place_id, c.path, c.user_id, c.nickname, c.rank = 0
  from c
  where c.rank < 2
     or not exists (select 1 from public.reports r where r.target_user = c.user_id and r.target_place = c.place_id)
  order by c.place_id, c.rank, c.created_at desc
$$;
