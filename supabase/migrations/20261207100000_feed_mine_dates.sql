-- 68-9 피드에 내 평가 · 가져온 평가 날짜를 지도 저장일로

-- 피드 탭에는 내 평가(전체 · 팔로워 공개)도 — 홈 '팔로잉 새 평가'는 p_mine 기본값(false)으로 지금처럼
drop function public.feed(timestamptz, int);
CREATE FUNCTION public.feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_mine boolean DEFAULT false)
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
  from public.user_places up
  join public.profiles pr on pr.id = up.user_id
  join public.places pl on pl.id = up.place_id
  where up.user_id in (
          select f.followee_id from public.follows f where f.follower_id = (select auth.uid())
          union all
          select (select auth.uid()) where p_mine
        )
    and up.visibility in ('public', 'followers')
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and (p_before is null or up.updated_at < p_before)
  order by up.updated_at desc
  limit least(p_limit, 50)
$function$;
revoke execute on function public.feed(timestamptz, int, boolean) from public, anon;
grant execute on function public.feed(timestamptz, int, boolean) to authenticated;

-- 68 전에 가져온 평가는 updated_at 이 가져온 때라 피드 날짜가 모두 같은 날 — 지도에 저장한 때(saved_at)로 되돌린다
-- 한꺼번에 가져온 줄만: 같은 사람 · 같은 분에 10곳 넘게 (먹킷에서 평가하면 updated_at 이 바뀌어 이 묶음에서 빠짐)
with burst as (
  select user_id, date_trunc('minute', updated_at) as m
    from public.user_places
   group by 1, 2
  having count(*) >= 10
)
update public.user_places up
   set updated_at = up.saved_at
  from burst b
 where b.user_id = up.user_id
   and date_trunc('minute', up.updated_at) = b.m
   and up.saved_at < up.updated_at
   and exists (select 1 from public.imported_items i where i.user_id = up.user_id and i.place_id = up.place_id);
