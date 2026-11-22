-- 홈 '새로 올라온 리스트' 카드 썸네일 — 담긴 곳의 가게 id · 업종을 함께 (대표 사진 · 업종 아이콘용)
create or replace function public.recent_public_lists(p_limit int default 6)
returns table (id uuid, name text, owner_nickname text, count int, points jsonb)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, pr.nickname,
         (select count(*)::int from public.list_items li where li.list_id = l.id),
         coalesce((
           select jsonb_agg(jsonb_build_object('placeId', pl.id, 'cuisine', pl.cuisine, 'lat', pl.lat, 'lng', pl.lng,
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
