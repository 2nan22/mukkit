-- 70 피드 더 보기 — 이어 받는 자리를 시각 + 사람 + 장소로. 같은 시각 평가가 많아도 빠지거나 겹치지 않게
-- (가져오기는 지도 저장일이 같은 곳이 여럿일 수 있음 · 앞 쪽 마지막 줄의 세 값을 넘긴다)
drop function public.feed(timestamptz, int, boolean);
CREATE FUNCTION public.feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_mine boolean DEFAULT false, p_before_owner uuid DEFAULT NULL::uuid, p_before_place uuid DEFAULT NULL::uuid)
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
         case when n.shown then up.note else '' end,
         case when n.shown then public.note_source(up) end,
         case when n.shown then public.place_alias(up) else '' end
  from public.user_places up
  cross join lateral (
    select case when up.user_id = (select auth.uid()) then up.note_visibility is distinct from 'private'
                else public.can_see_note(up.user_id, up.note_visibility) end as shown
  ) n
  join public.profiles pr on pr.id = up.user_id
  join public.places pl on pl.id = up.place_id
  where up.user_id in (
          select f.followee_id from public.follows f where f.follower_id = (select auth.uid())
          union all
          select (select auth.uid()) where p_mine
        )
    and up.visibility in ('public', 'followers')
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and (up.user_id = (select auth.uid()) or not public.is_rating_hidden(up.user_id, up.place_id))
    and (p_before is null
         or (up.updated_at, up.user_id, up.place_id)
            < (p_before, coalesce(p_before_owner, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid), coalesce(p_before_place, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by up.updated_at desc, up.user_id desc, up.place_id desc
  limit least(p_limit, 50)
$function$;
revoke execute on function public.feed(timestamptz, int, boolean, uuid, uuid) from public, anon;
grant execute on function public.feed(timestamptz, int, boolean, uuid, uuid) to authenticated;

