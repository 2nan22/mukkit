-- 82 피드 날짜 — 사진 · 한 줄 평가 · 메뉴 · 메모를 고쳐도 피드 날짜 · 순서가 바뀌지 않게 (사용자 결정 2026-11-27)
-- rated_at: 등급을 처음 매기거나 바꾼 때. 피드 · 프로필 순서와 카드 날짜(방문일이 없을 때)는 이것으로
-- updated_at 은 마지막으로 고친 때 그대로 둔다 (내 장소 정렬 등)
alter table public.user_places add column rated_at timestamptz;
-- 이미 고친 평가는 원래 날짜를 알 수 없어 지금 updated_at 으로
update public.user_places set rated_at = updated_at;
alter table public.user_places alter column rated_at set not null, alter column rated_at set default now();

-- 등급이 바뀐 때만 rated_at 을 옮긴다 — 값은 그 줄의 updated_at (사용자가 고치면 지금, 가져오기는 지도 저장일)
-- updated_at 을 안 건드리는 새벽 새로 고침이 등급을 채워도 피드 맨 위로 올라가지 않게
create function public.user_places_rated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.tier is distinct from old.tier then
    -- 미래 시각은 지금으로 — 보낸 updated_at 으로 피드 맨 위에 박히지 않게
    new.rated_at := least(coalesce(new.updated_at, now()), now());
  else
    new.rated_at := old.rated_at;
  end if;
  return new;
end
$$;
create trigger user_places_rated_at before insert or update on public.user_places
  for each row execute function public.user_places_rated_at();

create index user_places_user_rated_idx on public.user_places (user_id, rated_at desc);

-- 남에게 평가를 보여 주는 함수들 — updated_at 대신 rated_at, 방문일도 함께 (돌려주는 모양이 바뀌어 다시 만든다)
drop function public.feed(timestamptz, int, boolean, uuid, uuid);
CREATE FUNCTION public.feed(p_before timestamp with time zone DEFAULT NULL::timestamp with time zone, p_limit integer DEFAULT 20, p_mine boolean DEFAULT false, p_before_owner uuid DEFAULT NULL::uuid, p_before_place uuid DEFAULT NULL::uuid)
 RETURNS TABLE(owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, rated_at timestamp with time zone, visited_on date, companions jsonb, menus text[], note text, note_source text, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine,
         up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.rated_at, up.visited_on,
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
         or (up.rated_at, up.user_id, up.place_id)
            < (p_before, coalesce(p_before_owner, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid), coalesce(p_before_place, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by up.rated_at desc, up.user_id desc, up.place_id desc
  limit least(p_limit, 50)
$function$;
revoke execute on function public.feed(timestamptz, int, boolean, uuid, uuid) from public, anon;
grant execute on function public.feed(timestamptz, int, boolean, uuid, uuid) to authenticated;

drop function public.profile_ratings(uuid, int);
CREATE FUNCTION public.profile_ratings(p_owner uuid, p_limit integer DEFAULT 60)
 RETURNS TABLE(place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, rated_at timestamp with time zone, visited_on date, companions jsonb, menus text[], note text, note_source text, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.rated_at, up.visited_on,
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
  order by up.rated_at desc
  limit least(p_limit, 200)
$function$;
revoke execute on function public.profile_ratings(uuid, int) from public;
grant execute on function public.profile_ratings(uuid, int) to anon, authenticated;

drop function public.rating_detail(uuid, uuid);
CREATE FUNCTION public.rating_detail(p_owner uuid, p_place uuid)
 RETURNS TABLE(owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text, tier tier, review text, media jsonb, rated_at timestamp with time zone, visited_on date, companions jsonb, menus text[], note text, note_source text, alias text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.rated_at, up.visited_on,
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
