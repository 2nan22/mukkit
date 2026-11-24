-- 네이버 별명 (68-7, 사용자 결정 2026-11-25 — 별명인 줄 알 수 있게 배지, 메모는 메모) — 메모에 합치지 않고 원본 기록에 따로
-- 별명은 지도 앱이 가진 값이라 먹킷에서 고치지 않는다 — imported_items.alias 에만 두고, 보여 줄 때 가장 최근 원본의 별명
alter table public.imported_items add column alias text not null default '';

-- PostgREST 계산 칸 — select("place_alias")로 읽힌다. 공개 범위는 메모를 따른다(보여 주는 함수가 can_see_note 로 거름)
create function public.place_alias(up public.user_places)
returns text language sql stable set search_path = '' as $$
  select coalesce((
    select i.alias from public.imported_items i
     where i.user_id = up.user_id and i.place_id = up.place_id and i.alias <> ''
     order by i.imported_at desc
     limit 1), '')
$$;
revoke execute on function public.place_alias(public.user_places) from public, anon;
grant execute on function public.place_alias(public.user_places) to authenticated, service_role;

-- 남에게 평가를 보여 주는 함수들 — 별명도 메모와 같은 공개 범위로 (돌려주는 모양이 바뀌어 다시 만든다)
drop function public.feed(timestamptz, int);
CREATE FUNCTION public.feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20)
 RETURNS TABLE(owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, updated_at timestamp with time zone, companions jsonb, menus text[], note text, note_source text, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine,
         up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, true),
         up.menus,
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.note_source(up) end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.place_alias(up) else '' end
  from public.follows f
  join public.user_places up on up.user_id = f.followee_id
  join public.profiles pr on pr.id = up.user_id
  join public.places pl on pl.id = up.place_id
  where f.follower_id = (select auth.uid())
    and up.visibility in ('public', 'followers')
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and (p_before is null or up.updated_at < p_before)
  order by up.updated_at desc
  limit least(p_limit, 50)
$function$;
revoke execute on function public.feed(timestamptz, int) from public, anon;
grant execute on function public.feed(timestamptz, int) to authenticated;

drop function public.profile_ratings(uuid, int);
CREATE FUNCTION public.profile_ratings(p_owner uuid, p_limit integer DEFAULT 60)
 RETURNS TABLE(place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, updated_at timestamp with time zone, companions jsonb, menus text[], note text, note_source text, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, false),
         up.menus,
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.note_source(up) end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.place_alias(up) else '' end
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  where up.user_id = p_owner
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(up.user_id, up.place_id)
  order by up.updated_at desc
  limit least(p_limit, 200)
$function$;
revoke execute on function public.profile_ratings(uuid, int) from public;
grant execute on function public.profile_ratings(uuid, int) to anon, authenticated;

drop function public.place_ratings(uuid);
CREATE FUNCTION public.place_ratings(p_place uuid)
 RETURNS TABLE(user_id uuid, nickname text, followed boolean, tier tier, review text, visited_on date, sponsored boolean, media jsonb, rated_count integer, three_ratio integer, updated_at timestamp with time zone, companions jsonb, menus text[], note text, note_source text, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select up.user_id, pr.nickname,
         exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = up.user_id),
         up.tier, up.review, up.visited_on, up.sponsored,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         s.three + s.two + s.one + s.not_recommended + s.sponsored,
         coalesce(round(100.0 * s.three / nullif(s.three + s.two + s.one + s.not_recommended, 0))::int, 0),
         up.updated_at,
         public.visit_companions(up.user_id, up.place_id, false),
         up.menus,
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.note_source(up) end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.place_alias(up) else '' end
  from public.user_places up
  join public.profiles pr on pr.id = up.user_id
  cross join lateral public.profile_stats(up.user_id) s
  where up.place_id = p_place
    and up.user_id <> coalesce((select auth.uid()), '00000000-0000-0000-0000-000000000000')
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(up.user_id, up.place_id)
  order by 3 desc, public.tier_score(up.tier) desc, up.updated_at desc
  limit 50
$function$;
revoke execute on function public.place_ratings(uuid) from public;
grant execute on function public.place_ratings(uuid) to anon, authenticated;

drop function public.rating_detail(uuid, uuid);
CREATE FUNCTION public.rating_detail(p_owner uuid, p_place uuid)
 RETURNS TABLE(owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, updated_at timestamp with time zone, companions jsonb, menus text[], note text, note_source text, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, false),
         up.menus,
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.note_source(up) end,
         case when public.can_see_note(up.user_id, up.note_visibility) then public.place_alias(up) else '' end
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  join public.profiles pr on pr.id = up.user_id
  where up.user_id = p_owner and up.place_id = p_place
    and public.is_viewable_rating(p_owner, p_place)
$function$;
revoke execute on function public.rating_detail(uuid, uuid) from public, anon;
grant execute on function public.rating_detail(uuid, uuid) to authenticated;
