-- 메모 공개 스위치 (68-4, 사용자 결정 2026-11-25) — '나만 보는 메모'를 평가마다 공개할 수 있게. 켜면 평가 공개 범위대로 남에게 보인다
-- 68-2 의 '메모를 한 줄 평가로 복사'는 배포 전이라 걷어 낸다(같은 내용이 두 칸에 생기지 않게)
alter table public.user_places add column note_public boolean not null default false;

drop function public.copy_notes_to_review(uuid, uuid[]);
drop function public.count_notes_to_review(uuid);
-- 가져올 때 '지도 앱 메모도 공개'를 골랐는지 — 이름만 뜻에 맞게
alter table public.import_sources rename column memo_to_review to note_public;

-- 가져온 메모 공개 — 다녀온 등급 · 메모가 지도 앱 메모 그대로인 곳만(먹킷에서 직접 쓴 메모는 건드리지 않음). updated_at 그대로
-- security invoker — 사용자는 RLS 로 자기 줄만(다른 p_user 는 0줄). 가져오기 · 새벽 새로 고침은 서비스 키로 그 사용자 것만
create function public.publish_imported_notes(p_user uuid, p_places uuid[] default null)
returns int language sql security invoker set search_path = '' as $$
  with done as (
    update public.user_places up
       set note_public = true
     where up.user_id = p_user
       and (p_places is null or up.place_id = any (p_places))
       and up.tier in ('three', 'two', 'one', 'not_recommended')
       and not up.note_public
       and btrim(up.note) <> ''
       and exists (
         select 1 from public.imported_items i
          where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
       )
    returning 1
  )
  select count(*)::int from done
$$;
revoke execute on function public.publish_imported_notes(uuid, uuid[]) from public, anon;
grant execute on function public.publish_imported_notes(uuid, uuid[]) to authenticated, service_role;

create function public.count_unpublished_imported_notes(p_user uuid)
returns int language sql stable security invoker set search_path = '' as $$
  select count(*)::int from public.user_places up
   where up.user_id = p_user
     and up.tier in ('three', 'two', 'one', 'not_recommended')
     and not up.note_public
     and btrim(up.note) <> ''
     and exists (
       select 1 from public.imported_items i
        where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
     )
$$;
revoke execute on function public.count_unpublished_imported_notes(uuid) from public, anon;
grant execute on function public.count_unpublished_imported_notes(uuid) to authenticated;

-- 남에게 평가를 보여 주는 함수들 — 메모는 공개로 켠 것만 (끈 메모는 빈 값)

drop function public.feed(timestamptz, int);
CREATE FUNCTION public.feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20)
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
         case when up.note_public then up.note else '' end
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
revoke execute on function public.feed(timestamptz, int) from public;
grant execute on function public.feed(timestamptz, int) to authenticated;

drop function public.profile_ratings(uuid, int);
CREATE FUNCTION public.profile_ratings(p_owner uuid, p_limit integer DEFAULT 60)
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
         case when up.note_public then up.note else '' end
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
         case when up.note_public then up.note else '' end
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
         case when up.note_public then up.note else '' end
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  join public.profiles pr on pr.id = up.user_id
  where up.user_id = p_owner and up.place_id = p_place
    and public.is_viewable_rating(p_owner, p_place)
$function$;
revoke execute on function public.rating_detail(uuid, uuid) from public;
grant execute on function public.rating_detail(uuid, uuid) to authenticated;
