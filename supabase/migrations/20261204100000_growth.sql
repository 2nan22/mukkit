-- 키우는 캐릭터 · 레벨 (63) — 점수는 쌓아 두지 않고 지금 남은 기록에서 다시 계산한다
-- 평가를 지우거나 신고로 숨겨지면 저절로 빠지고, 협찬 표시 평가는 처음부터 세지 않는다
-- 점수 수치는 src/domain/growth.ts 와 같다 (바꾸면 둘 다)
create function public.my_growth()
returns table(
  ratings int, reviews int, media int, areas int, kinds int, ranked int,
  likes_points int, list_saves int, visits int, imported boolean, top_kind text
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  rated as (
    select up.place_id, up.review, up.tier, up.tier_rank, p.food_kind,
           nullif(trim(split_part(p.address, ' ', 1) || ' ' || split_part(p.address, ' ', 2)), '') as area
    from public.user_places up
    join public.places p on p.id = up.place_id
    where up.user_id = (select id from me)
      and up.tier in ('three', 'two', 'one', 'not_recommended')
      and not up.sponsored
      and not public.is_rating_hidden(up.user_id, up.place_id)
  ),
  liked as (
    -- 평가마다 받은 좋아요 점수(2점씩, 평가당 20점까지) — 사람 · 평가마다 한 번은 기본키가 보장
    select least(count(*) * 2, 20)::int as pts
    from public.rating_likes l
    join rated r on r.place_id = l.place_id
    where l.owner_id = (select id from me)
    group by l.place_id
  )
  select
    (select count(*)::int from rated),
    (select count(*)::int from rated where char_length(trim(review)) >= 10),
    (select count(distinct m.place_id)::int from public.rating_media m join rated r on r.place_id = m.place_id where m.user_id = (select id from me)),
    (select count(distinct area)::int from rated where area is not null),
    (select count(distinct food_kind)::int from rated where food_kind is not null),
    (select least(count(*), 10)::int from rated where tier = 'three' and tier_rank is not null),
    (select coalesce(sum(pts), 0)::int from liked),
    (select count(*)::int from public.saved_lists s join public.lists l on l.id = s.list_id
       where l.owner_id = (select id from me) and l.visibility in ('link', 'public') and s.user_id <> (select id from me)),
    (select count(distinct v.id)::int from public.visits v join public.visit_members vm on vm.visit_id = v.id
       where v.created_by = (select id from me) and vm.user_id is not null and vm.user_id <> (select id from me) and vm.status = 'accepted'),
    exists (select 1 from public.imported_items i where i.user_id = (select id from me)),
    (select food_kind from rated where food_kind is not null group by food_kind order by count(*) desc, food_kind limit 1)
$$;
revoke all on function public.my_growth() from public, anon;
grant execute on function public.my_growth() to authenticated;
