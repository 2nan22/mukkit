-- 가져온 메모를 한 줄 평가로 (68-2, 사용자 결정 2026-11-25) — 피드 · 장소에는 한 줄 평가만 나가고 메모는 나만 보므로
-- 다녀온 등급(3 · 2 · 1숟가락 · 추천 안 함)이고 한 줄 평가가 비어 있는 곳만, 메모 앞 200자. 메모는 그대로 두고 updated_at 도 그대로(피드 몰림 방지)
-- 지도 앱에서 가져온 메모 그대로인 것만 — 먹킷에서 직접 쓴 '나만 보는 메모'는 공개하지 않는다
-- security invoker — 사용자는 RLS 로 자기 줄만 바뀐다(다른 p_user 를 넘겨도 0줄). 새벽 새로 고침은 서비스 키로 그 사용자 것만
create function public.copy_notes_to_review(p_user uuid, p_places uuid[] default null)
returns int language sql security invoker set search_path = '' as $$
  with done as (
    update public.user_places up
       set review = left(btrim(up.note), 200)
     where up.user_id = p_user
       and (p_places is null or up.place_id = any (p_places))
       and up.tier in ('three', 'two', 'one', 'not_recommended')
       and up.review = ''
       and btrim(up.note) <> ''
       and exists (
         select 1 from public.imported_items i
          where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
       )
    returning 1
  )
  select count(*)::int from done
$$;
revoke execute on function public.copy_notes_to_review(uuid, uuid[]) from public, anon;
grant execute on function public.copy_notes_to_review(uuid, uuid[]) to authenticated, service_role;

-- 옮길 수 있는 곳 수 — 설정 화면에서 미리 보여 준다 (조건은 위와 같음)
create function public.count_notes_to_review(p_user uuid)
returns int language sql stable security invoker set search_path = '' as $$
  select count(*)::int from public.user_places up
   where up.user_id = p_user
     and up.tier in ('three', 'two', 'one', 'not_recommended')
     and up.review = ''
     and btrim(up.note) <> ''
     and exists (
       select 1 from public.imported_items i
        where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
     )
$$;
revoke execute on function public.count_notes_to_review(uuid) from public, anon;
grant execute on function public.count_notes_to_review(uuid) to authenticated;
