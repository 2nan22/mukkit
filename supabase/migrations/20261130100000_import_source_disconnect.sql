-- 가져온 원본 끊기 · 지우기 (42)
-- 연결만 끊기: 원본 기록 · 새로 고침만 지우고 장소 · 등급 · 메모 · 사진 · 먹킷 리스트는 그대로 (리스트는 보통 리스트가 됨)
-- 장소까지 지우기: 이 원본에서 가져온 곳 중 다른 리스트 · 다른 원본에 없는 곳의 평가(등급 · 메모 · 사진 · 좋아요 · 댓글)와
--   이 원본으로 만든 먹킷 리스트까지 지움. 사진 파일은 Storage 라 서버가 돌려받은 경로로 지운다
-- 모두 호출한 사람 권한(RLS)으로만 — 남의 것은 건드릴 수 없다

-- 지울 수 있는 곳 — 이 원본에서만 온 내 장소
create function public.import_source_delete_targets(p_source text, p_source_list_id text)
returns setof uuid
language sql stable security invoker set search_path = '' as $$
  select distinct ii.place_id
  from public.imported_items ii
  join public.user_places up on up.user_id = ii.user_id and up.place_id = ii.place_id
  where ii.user_id = (select auth.uid())
    and ii.source = p_source and ii.source_list_id = p_source_list_id
    -- 다른 내 리스트에 담긴 곳은 남긴다 (이 원본으로 만든 리스트는 같이 지우니 제외)
    and not exists (
      select 1 from public.list_items li join public.lists l on l.id = li.list_id
      where l.owner_id = ii.user_id and li.place_id = ii.place_id
        and (coalesce(l.source, '') <> p_source or coalesce(l.source_list_id, '') <> p_source_list_id))
    -- 다른 원본에서도 가져온 곳은 남긴다
    and not exists (
      select 1 from public.imported_items o
      where o.user_id = ii.user_id and o.place_id = ii.place_id
        and (o.source <> p_source or o.source_list_id <> p_source_list_id))
$$;

-- 끊기 — 지운 평가의 사진 · 영상 경로를 돌려준다 (연결만 끊으면 빈 목록)
create function public.disconnect_import_source(p_source text, p_source_list_id text, p_delete_places boolean)
returns setof text
language plpgsql security invoker set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  targets uuid[];
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_delete_places then
    targets := array(select public.import_source_delete_targets(p_source, p_source_list_id));
    return query
      select m.path from public.rating_media m where m.user_id = me and m.place_id = any (targets);
    delete from public.user_places where user_id = me and place_id = any (targets);
    delete from public.lists where owner_id = me and source = p_source and source_list_id = p_source_list_id;
  else
    update public.lists set source = null, source_list_id = null, updated_at = now()
    where owner_id = me and source = p_source and source_list_id = p_source_list_id;
  end if;
  delete from public.imported_items where user_id = me and source = p_source and source_list_id = p_source_list_id;
  delete from public.import_sources where user_id = me and source = p_source and source_list_id = p_source_list_id;
end
$$;

revoke execute on function public.import_source_delete_targets(text, text) from public, anon;
revoke execute on function public.disconnect_import_source(text, text, boolean) from public, anon;
grant execute on function public.import_source_delete_targets(text, text) to authenticated;
grant execute on function public.disconnect_import_source(text, text, boolean) to authenticated;
