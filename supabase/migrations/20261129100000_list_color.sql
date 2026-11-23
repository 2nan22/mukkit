-- 리스트 색 — 지도 '리스트로 보기' 핀 색. 이름만 저장(색값은 앱 domain/listColor.ts)
-- 등급 핀 색(빨강 · 주황 · 노랑)과 회색은 팔레트에서 뺐다
alter table public.lists add column color text
  check (color is null or color in ('green', 'teal', 'blue', 'navy', 'indigo', 'purple', 'olive', 'brown'));

-- 새 리스트는 그 사람이 아직 안 쓴 색부터 (다 썼으면 가장 적게 쓴 색) — 리스트끼리 색이 겹치지 않게
create function public.pick_list_color(owner uuid) returns text
language sql stable security definer set search_path = '' as $$
  select c from unnest(array['green', 'teal', 'blue', 'navy', 'indigo', 'purple', 'olive', 'brown']) with ordinality as p(c, i)
  order by (select count(*) from public.lists l where l.owner_id = owner and l.color = p.c), i
  limit 1
$$;
revoke all on function public.pick_list_color(uuid) from public, anon, authenticated;

create function public.set_list_color() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.color is null then
    new.color := public.pick_list_color(new.owner_id);
  end if;
  return new;
end
$$;
create trigger lists_set_color before insert on public.lists for each row execute function public.set_list_color();

-- 이미 있는 리스트 채우기 — 사람마다 만든 순서대로 팔레트를 돈다
update public.lists l set color = (array['green', 'teal', 'blue', 'navy', 'indigo', 'purple', 'olive', 'brown'])[((r.n - 1) % 8) + 1]
from (select id, row_number() over (partition by owner_id order by created_at) as n from public.lists) r
where l.id = r.id and l.color is null;
