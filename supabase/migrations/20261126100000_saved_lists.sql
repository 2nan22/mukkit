-- 남의 리스트 저장 (25) — 링크 · 공개 리스트를 북마크처럼. 주인이 고치면 따라 바뀐다
-- 저장 수는 숫자만 공개(누가 저장했는지는 안 보임) · 가게를 내 장소에 담는 것은 따로(선택)
create table public.saved_lists (
  user_id uuid not null references public.profiles (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  saved_at timestamptz not null default now(),
  -- 마지막으로 본 때 — 그 뒤에 담긴 곳이 '새로 추가된 곳'
  last_seen_at timestamptz not null default now(),
  primary key (user_id, list_id)
);
create index saved_lists_list_idx on public.saved_lists (list_id);
alter table public.saved_lists enable row level security;

-- 저장할 수 있는 리스트 — 링크 · 공개, 내 것 아님, 서로 차단 아님
create function public.can_save_list(p_list uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lists l
    where l.id = p_list and l.visibility in ('link', 'public')
      and l.owner_id <> (select auth.uid())
      and not public.is_blocked((select auth.uid()), l.owner_id)
  );
$$;
revoke execute on function public.can_save_list(uuid) from public, anon;
grant execute on function public.can_save_list(uuid) to authenticated;

create policy "리스트 저장은 내가 · 저장할 수 있는 것만" on public.saved_lists for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_save_list(list_id));
create policy "저장한 리스트는 내 것만 봄" on public.saved_lists for select to authenticated using (user_id = (select auth.uid()));
create policy "저장 해제는 내 것만" on public.saved_lists for delete to authenticated using (user_id = (select auth.uid()));
create policy "본 시각은 내 것만" on public.saved_lists for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 리스트 하나의 저장 수 · 내가 저장했나 · 주인 — 링크 · 공개 리스트이거나 내 리스트일 때만
create function public.list_meta(p_list uuid)
returns table (owner_id uuid, saves int, saved boolean, mine boolean)
language sql stable security definer set search_path = '' as $$
  select l.owner_id,
         (select count(*)::int from public.saved_lists s where s.list_id = l.id),
         exists (select 1 from public.saved_lists s where s.list_id = l.id and s.user_id = (select auth.uid())),
         l.owner_id = (select auth.uid())
  from public.lists l
  where l.id = p_list
    and (l.owner_id = (select auth.uid())
         or (l.visibility in ('link', 'public') and not public.is_blocked((select auth.uid()), l.owner_id)))
$$;
grant execute on function public.list_meta(uuid) to anon, authenticated;

-- 내가 저장한 리스트 — 지금 볼 수 없는 것(비공개로 바뀜 · 차단)은 빼고, 최근 담긴 순
create function public.my_saved_lists()
returns table (id uuid, name text, owner_nickname text, count int, new_count int, updated_at timestamptz, cuisines text[])
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, pr.nickname,
         (select count(*)::int from public.list_items li where li.list_id = l.id),
         (select count(*)::int from public.list_items li where li.list_id = l.id and li.added_at > s.last_seen_at),
         greatest(l.updated_at, coalesce((select max(li.added_at) from public.list_items li where li.list_id = l.id), l.updated_at)),
         array(select pl.cuisine from public.list_items li join public.places pl on pl.id = li.place_id
               where li.list_id = l.id group by pl.cuisine order by count(*) desc limit 2)
  from public.saved_lists s
  join public.lists l on l.id = s.list_id
  join public.profiles pr on pr.id = l.owner_id
  where s.user_id = (select auth.uid())
    and l.visibility in ('link', 'public')
    and not public.is_blocked((select auth.uid()), l.owner_id)
  order by 6 desc
$$;
revoke execute on function public.my_saved_lists() from public, anon;
grant execute on function public.my_saved_lists() to authenticated;

-- 차단하면 서로의 리스트 저장도 정리
create or replace function public.after_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
    where (follower_id = new.blocker_id and followee_id = new.blocked_id) or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.meetup_invites mi using public.meetups m
    where mi.meetup_id = m.id
      and ((m.host_id = new.blocker_id and mi.user_id = new.blocked_id) or (m.host_id = new.blocked_id and mi.user_id = new.blocker_id));
  delete from public.visit_members vm using public.visits v
    where vm.visit_id = v.id and vm.status = 'invited'
      and ((v.created_by = new.blocker_id and vm.user_id = new.blocked_id) or (v.created_by = new.blocked_id and vm.user_id = new.blocker_id));
  delete from public.saved_lists s using public.lists l
    where s.list_id = l.id
      and ((s.user_id = new.blocker_id and l.owner_id = new.blocked_id) or (s.user_id = new.blocked_id and l.owner_id = new.blocker_id));
  return new;
end;
$$;
