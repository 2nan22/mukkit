-- 메모 공개 범위 (68-5, 사용자 결정 2026-11-25) — 켜고 끄기 대신 평가처럼 나만 · 팔로워 · 전체, 기본은 평가 공개 범위와 같게
-- note_visibility: null 평가와 같게(기본) · private · followers · public. 평가를 볼 수 있는 사람 중에서만 거른다(평가보다 넓어지지 않음)
alter table public.user_places add column note_visibility public.rating_visibility;
-- 지금까지 '나만 보는 메모'로 알고 쓴 메모는 나만으로 남긴다 — 공개로 켠 것만 평가와 같게. 바꾸려면 설정에서 한 번에
update public.user_places set note_visibility = case when note_public then null else 'private'::public.rating_visibility end where btrim(note) <> '';
drop trigger user_places_note_public_guard on public.user_places;
drop function public.user_places_note_public_guard();
drop function public.publish_imported_notes(uuid, uuid[]);
drop function public.count_unpublished_imported_notes(uuid);

-- 가져올 때 리스트마다 고른 메모 공개 범위 — null 평가와 같게. 새벽 새로 고침으로 들어온 곳도 같게
alter table public.import_sources add column note_visibility public.rating_visibility;
update public.import_sources set note_visibility = 'private' where not note_public;
alter table public.import_sources drop column note_public;

-- 보는 사람(auth.uid())이 이 메모를 볼 수 있는지 — 평가를 볼 수 있는지는 부르는 쪽이 이미 거름
create function public.can_see_note(p_owner uuid, p_vis public.rating_visibility)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_owner = (select auth.uid()) then true
    when p_vis is null or p_vis = 'public' then true
    when p_vis = 'followers' then exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = p_owner)
    else false
  end
$$;
-- 보여 주는 함수(security definer) 안에서만 쓴다 — 바로 부를 길은 막음
revoke execute on function public.can_see_note(uuid, public.rating_visibility) from public, anon, authenticated;

-- 메모 공개 범위의 넓이 — 나만 0 · 팔로워 1 · 전체 2 · 평가와 같게(null) 3
create function public.note_rank(p_vis public.rating_visibility)
returns int language sql immutable set search_path = '' as $$
  select case p_vis when 'private' then 0 when 'followers' then 1 when 'public' then 2 else 3 end
$$;

-- 가져온 메모의 공개 범위를 한 번에 — 다녀온 등급 · 메모가 지도 앱 메모 그대로인 곳만(직접 쓴 메모는 건드리지 않음). updated_at 그대로
-- p_places null 이면 전부(설정), 있으면 그 장소만(가져오기 · 새로 고침). security invoker — RLS 로 자기 줄만
-- 가져오기 · 새로 고침은 좁히기만 — 평가에서 나만으로 바꿔 둔 메모가 다시 가져오며 넓어지지 않게 (평가와 같게(null)가 가장 넓음)
create function public.set_imported_note_visibility(p_user uuid, p_vis public.rating_visibility, p_places uuid[] default null)
returns int language sql security invoker set search_path = '' as $$
  with done as (
    update public.user_places up
       set note_visibility = p_vis
     where up.user_id = p_user
       and (p_places is null or up.place_id = any (p_places))
       and up.tier in ('three', 'two', 'one', 'not_recommended')
       and up.note_visibility is distinct from p_vis
       and (p_places is null or public.note_rank(p_vis) < public.note_rank(up.note_visibility))
       and btrim(up.note) <> ''
       and exists (
         select 1 from public.imported_items i
          where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
       )
    returning 1
  )
  select count(*)::int from done
$$;
revoke execute on function public.set_imported_note_visibility(uuid, public.rating_visibility, uuid[]) from public, anon;
grant execute on function public.set_imported_note_visibility(uuid, public.rating_visibility, uuid[]) to authenticated, service_role;

-- 나만으로 남아 있는 가져온 메모 수 — 설정 '가져온 메모도 평가와 같게'
create function public.count_private_imported_notes(p_user uuid)
returns int language sql stable security invoker set search_path = '' as $$
  select count(*)::int from public.user_places up
   where up.user_id = p_user
     and up.tier in ('three', 'two', 'one', 'not_recommended')
     and up.note_visibility = 'private'
     and btrim(up.note) <> ''
     and exists (
       select 1 from public.imported_items i
        where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
     )
$$;
revoke execute on function public.count_private_imported_notes(uuid) from public, anon;
grant execute on function public.count_private_imported_notes(uuid) to authenticated;

-- 남에게 평가를 보여 주는 함수들 — 메모는 메모 공개 범위대로 (돌려주는 모양은 그대로)
CREATE OR REPLACE FUNCTION public.feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20)
 RETURNS TABLE(owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, updated_at timestamp with time zone, companions jsonb, menus text[], note text)
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
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end
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

CREATE OR REPLACE FUNCTION public.profile_ratings(p_owner uuid, p_limit integer DEFAULT 60)
 RETURNS TABLE(place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, updated_at timestamp with time zone, companions jsonb, menus text[], note text)
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
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  where up.user_id = p_owner
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(up.user_id, up.place_id)
  order by up.updated_at desc
  limit least(p_limit, 200)
$function$;

CREATE OR REPLACE FUNCTION public.place_ratings(p_place uuid)
 RETURNS TABLE(user_id uuid, nickname text, followed boolean, tier tier, review text, visited_on date, sponsored boolean, media jsonb, rated_count integer, three_ratio integer, updated_at timestamp with time zone, companions jsonb, menus text[], note text)
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
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end
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

CREATE OR REPLACE FUNCTION public.rating_detail(p_owner uuid, p_place uuid)
 RETURNS TABLE(owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, updated_at timestamp with time zone, companions jsonb, menus text[], note text)
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
         case when public.can_see_note(up.user_id, up.note_visibility) then up.note else '' end
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  join public.profiles pr on pr.id = up.user_id
  where up.user_id = p_owner and up.place_id = p_place
    and public.is_viewable_rating(p_owner, p_place)
$function$;

alter table public.user_places drop column note_public;
