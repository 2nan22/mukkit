-- 평가 사진 순서 바꾸기 (77) — 화면 순서는 rating_media.created_at 순(피드 · 프로필 · 장소 함수 모두)이라
-- 고른 순서대로 이 평가 사진들의 created_at 을 서로 바꿔 끼운다(가장 이른 시각을 첫 사진에) — 시각 묶음은 그대로라
-- 다른 사람 사진과 견주는 '최근' 순서가 바뀌지 않는다 (77 검토)
create function public.reorder_my_media(p_place uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  -- 넘긴 목록이 이 평가의 사진 전부와 같아야 한다 (빠지거나 · 겹치거나 · 남의 것이 섞이면 거절)
  if (select count(*) from public.rating_media where user_id = me and place_id = p_place) <> cardinality(p_ids)
     or (select count(distinct i) from unnest(p_ids) i) <> cardinality(p_ids)
     or exists (select 1 from unnest(p_ids) i where not exists (
       select 1 from public.rating_media m where m.id = i and m.user_id = me and m.place_id = p_place)) then
    raise exception 'media mismatch';
  end if;
  update public.rating_media m
     -- 같은 시각으로 함께 올린 사진도 순서가 서도록 n 마이크로초씩 더한다
     set created_at = t.at + (o.n - 1) * interval '1 microsecond'
    from unnest(p_ids) with ordinality as o(id, n)
    join (
      select created_at as at, row_number() over (order by created_at, id) as n
        from public.rating_media where user_id = me and place_id = p_place
    ) t on t.n = o.n
   where m.id = o.id and m.user_id = me and m.place_id = p_place;
end $$;
revoke all on function public.reorder_my_media(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_my_media(uuid, uuid[]) to authenticated;

-- 장소 대표 사진 — 평가끼리는 그 평가의 가장 최근 사진 시각으로 견주고(전과 같음), 한 평가 안에서는 첫 사진(대표)을 (77)
create or replace function public.place_covers(p_places uuid[])
returns table (place_id uuid, path text, owner_id uuid, owner_nickname text, mine boolean)
language sql stable security definer set search_path = '' as $$
  with c as (
    select m.place_id, m.path, m.user_id, pr.nickname, m.created_at,
           max(m.created_at) over (partition by m.user_id, m.place_id) as rating_latest,
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
     or not exists (select 1 from public.reports r
                    where r.target_user = c.user_id and r.target_place = c.place_id and r.target_comment is null)
  order by c.place_id, c.rank,
           case when c.rank = 2 then (select count(*) from public.rating_likes l where l.owner_id = c.user_id and l.place_id = c.place_id) else 0 end desc,
           c.rating_latest desc, c.created_at asc
$$;
