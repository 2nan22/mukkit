-- QA 56 큰 데이터 — 끊기가 돌려주는 사진 경로를 배열 하나로 (setof 는 1000행에서 잘려 Storage 에 파일이 남음)
drop function public.disconnect_import_source(text, text, boolean);
create function public.disconnect_import_source(p_source text, p_source_list_id text, p_delete_places boolean)
returns text[]
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  targets uuid[];
  paths text[] := '{}';
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_delete_places then
    targets := array(select public.import_source_delete_targets(p_source, p_source_list_id));
    paths := array(select m.path from public.rating_media m where m.user_id = me and m.place_id = any (targets));
    delete from public.user_places where user_id = me and place_id = any (targets);
    delete from public.lists where owner_id = me and source = p_source and source_list_id = p_source_list_id;
  else
    update public.lists set source = null, source_list_id = null, updated_at = now()
    where owner_id = me and source = p_source and source_list_id = p_source_list_id;
  end if;
  delete from public.imported_items where user_id = me and source = p_source and source_list_id = p_source_list_id;
  delete from public.import_sources where user_id = me and source = p_source and source_list_id = p_source_list_id;
  return paths;
end
$$;
revoke execute on function public.disconnect_import_source(text, text, boolean) from public, anon;
grant execute on function public.disconnect_import_source(text, text, boolean) to authenticated;

-- 3숟가락에서 순위 있는 곳이 빠지면(등급 바꿈 · 삭제) 뒤 순위를 한 칸씩 당긴다 — 새 1위가 '2위'로 보이지 않게
create function public.close_tier_rank_gap() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.tier_rank is not null and (tg_op = 'DELETE' or new.tier is distinct from old.tier) then
    update public.user_places
       set tier_rank = tier_rank - 1
     where user_id = old.user_id and tier = 'three' and tier_rank > old.tier_rank;
  end if;
  return null;
end;
$$;
create trigger user_places_close_tier_rank_gap after update of tier or delete on public.user_places
  for each row execute function public.close_tier_rank_gap();
revoke execute on function public.close_tier_rank_gap() from public, anon, authenticated;

-- 장소 상세의 '평가 N곳'을 프로필과 같게 — 협찬 평가도 평가 수에는 센다(3숟가락 비율 통계에서만 뺌)
create or replace function public.place_ratings(p_place uuid)
 RETURNS TABLE(user_id uuid, nickname text, followed boolean, tier tier, review text, visited_on date, sponsored boolean, media jsonb, rated_count integer, three_ratio integer, updated_at timestamp with time zone, companions jsonb, menus text[])
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
         up.menus
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
