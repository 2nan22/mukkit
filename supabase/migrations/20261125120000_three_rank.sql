-- 3스타 비교 (23) — 내 3스타 안 순위. 0 이 1위, null 은 아직 안 정함
-- 순위는 나만 본다 (남에게 보이는 화면에는 아직 싣지 않음)
alter table public.user_places add column tier_rank int check (tier_rank >= 0);

-- 등급이 바뀌면 순위는 지운다 (3스타 → 2스타 등)
create function public.clear_tier_rank() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.tier is distinct from old.tier then
    new.tier_rank := null;
  end if;
  return new;
end;
$$;
create trigger user_places_clear_tier_rank before update of tier on public.user_places
  for each row execute function public.clear_tier_rank();
revoke execute on function public.clear_tier_rank() from public, anon, authenticated;

-- 내 3스타 순서를 한 번에 — 배열 순서가 순위. 배열에 없는 3스타는 그대로(안 정함 유지)
-- security invoker: 내 행만 고칠 수 있는 user_places 정책을 그대로 따른다
create function public.set_three_order(p_places uuid[]) returns void
language sql security invoker set search_path = '' as $$
  update public.user_places up
     set tier_rank = o.idx - 1
    from unnest(p_places[1:1000]) with ordinality as o(place_id, idx)
   where up.user_id = (select auth.uid()) and up.place_id = o.place_id and up.tier = 'three';
$$;
revoke execute on function public.set_three_order(uuid[]) from public, anon;
grant execute on function public.set_three_order(uuid[]) to authenticated;
