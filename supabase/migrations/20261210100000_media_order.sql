-- 평가 사진 순서 바꾸기 (77) — 화면 순서는 rating_media.created_at 순(피드 · 프로필 · 장소 함수 모두)이라
-- 고른 순서대로 created_at 을 다시 매긴다. 처음 값(가장 이른 시각)에서 1ms 씩 — 평가의 사진 시각 범위는 그대로
create function public.reorder_my_media(p_place uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  base timestamptz;
begin
  if me is null then raise exception 'not signed in'; end if;
  -- 넘긴 목록이 이 평가의 사진 전부와 같아야 한다 (빠지거나 남의 것이 섞이면 거절)
  if (select count(*) from public.rating_media where user_id = me and place_id = p_place) <> cardinality(p_ids)
     or exists (select 1 from unnest(p_ids) i where not exists (
       select 1 from public.rating_media m where m.id = i and m.user_id = me and m.place_id = p_place)) then
    raise exception 'media mismatch';
  end if;
  select min(created_at) into base from public.rating_media where user_id = me and place_id = p_place;
  update public.rating_media m
     set created_at = base + (o.n - 1) * interval '1 millisecond'
    from unnest(p_ids) with ordinality as o(id, n)
   where m.id = o.id and m.user_id = me and m.place_id = p_place;
end $$;
revoke all on function public.reorder_my_media(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_my_media(uuid, uuid[]) to authenticated;
