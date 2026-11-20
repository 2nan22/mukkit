-- 남의 저장 줄을 통째로 읽지 못하게 — 메모가 함께 새던 정책 제거
drop policy "남의 평가는 평가된 것만 읽음" on public.user_places;

-- 링크 · 공개 리스트를 누구나 읽는 유일한 통로 — 메모 · 원본 없이 장소와 평가된 등급만
create function public.public_list(p_list_id uuid)
returns table (
  list_name text,
  description text,
  visibility public.list_visibility,
  owner_nickname text,
  place_id uuid,
  name text,
  lat double precision,
  lng double precision,
  address text,
  cuisine text,
  category_name text,
  tier public.tier,
  added_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select l.name, l.description, l.visibility, pr.nickname,
         pl.id, pl.name, pl.lat, pl.lng, pl.address, pl.cuisine, pl.category_name,
         case when up.tier in ('three', 'two', 'one', 'not_recommended') then up.tier end,
         li.added_at
  from public.lists l
  join public.profiles pr on pr.id = l.owner_id
  left join public.list_items li on li.list_id = l.id
  left join public.places pl on pl.id = li.place_id
  left join public.user_places up on up.user_id = l.owner_id and up.place_id = li.place_id
  where l.id = p_list_id and l.visibility in ('link', 'public')
  order by li.added_at desc nulls last
$$;

revoke all on function public.public_list(uuid) from public;
grant execute on function public.public_list(uuid) to anon, authenticated;
