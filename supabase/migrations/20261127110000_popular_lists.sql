-- 요즘 많이 저장된 리스트 (28) — 최근 30일 저장 수 › 전체 저장 수 › 최근 고친 순. 공개 리스트만 · 내 것 · 차단한 사이 제외
-- 저장 수는 숫자만 (누가 저장했는지는 안 보임)
create function public.popular_public_lists(p_limit int default 4, p_offset int default 0)
returns table (id uuid, name text, owner_nickname text, count int, points jsonb, saves int, recent_saves int)
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
         ), '[]'::jsonb),
         (select count(*)::int from public.saved_lists s where s.list_id = l.id),
         (select count(*)::int from public.saved_lists s where s.list_id = l.id and s.saved_at > now() - interval '30 days')
  from public.lists l
  join public.profiles pr on pr.id = l.owner_id
  where l.visibility = 'public' and l.owner_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000')
    and not public.is_blocked((select auth.uid()), l.owner_id)
    and exists (select 1 from public.list_items li where li.list_id = l.id)
  order by 7 desc, 6 desc, l.updated_at desc
  limit least(p_limit, 40) offset greatest(p_offset, 0)
$$;
grant execute on function public.popular_public_lists(int, int) to anon, authenticated;
