-- 66 푸시 점검 (디자인 검토 C안)
-- 1) 팔로우 푸시 신설 — 설정에서 끌 수 있게 push_off 에 follow
alter table public.profiles drop constraint profiles_push_off_check;
alter table public.profiles add constraint profiles_push_off_check
  check (push_off <@ array['meetup', 'comment', 'visit', 'follow']::text[]);

-- 2) 추천 지역 알림을 알림함에도 — 약속 하나에 한 줄만 두고 최신 내용으로 바꾼다 (쌓이지 않게)
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'like', 'follow', 'meetup_invite', 'meetup_join', 'meetup_ready', 'visit_tag'));
-- 넣은 위치 종류(출발지 · 귀가지)와 추천 지역이 처음 나왔는지 — 문구용
alter table public.notifications add column point_kind text check (point_kind in ('origin', 'return'));
alter table public.notifications add column first_ready boolean;
create unique index notifications_meetup_ready_once on public.notifications (user_id, meetup_id) where kind = 'meetup_ready';

-- 처음 위치를 넣은 사람이 생기고 위치 넣은 사람이 둘 이상이면, 위치를 넣은 다른 참여자에게 (푸시와 같은 규칙)
create function public.on_meetup_point_notify() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  ready int;
begin
  -- 이 사람의 첫 위치일 때만 (고치거나 두 번째 종류를 넣을 때는 울리지 않음)
  if (select count(*) from public.meetup_points p where p.meetup_id = new.meetup_id and p.user_id = new.user_id) > 1 then return new; end if;
  if not exists (select 1 from public.meetups m where m.id = new.meetup_id and m.status = 'open') then return new; end if;
  select count(distinct p.user_id) into ready from public.meetup_points p where p.meetup_id = new.meetup_id;
  if ready < 2 then return new; end if;
  for r in select distinct p.user_id from public.meetup_points p where p.meetup_id = new.meetup_id and p.user_id <> new.user_id loop
    if exists (select 1 from public.blocks b where (b.blocker_id = r.user_id and b.blocked_id = new.user_id) or (b.blocker_id = new.user_id and b.blocked_id = r.user_id)) then continue; end if;
    insert into public.notifications (user_id, kind, actor_id, meetup_id, point_kind, first_ready)
    values (r.user_id, 'meetup_ready', new.user_id, new.meetup_id, new.kind, ready = 2)
    on conflict (user_id, meetup_id) where kind = 'meetup_ready'
      do update set actor_id = excluded.actor_id, point_kind = excluded.point_kind, first_ready = excluded.first_ready, created_at = now(), read_at = null;
  end loop;
  return new;
end;
$$;
revoke execute on function public.on_meetup_point_notify() from public, anon, authenticated;
create trigger meetup_points_notify after insert on public.meetup_points for each row execute function public.on_meetup_point_notify();

-- 알림함 — 위치 종류 · 처음 여부를 함께 (반환 칸이 바뀌어 다시 만든다)
drop function public.my_notifications(int);
create function public.my_notifications(p_limit int default 50)
returns table (id uuid, kind text, actor_id uuid, actor_nickname text, owner_id uuid, place_id uuid, place_name text, meetup_id uuid, visit_id uuid, created_at timestamptz, read boolean, point_kind text, first_ready boolean)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.actor_id, pr.nickname, n.owner_id, n.place_id, pl.name, n.meetup_id, n.visit_id, n.created_at, n.read_at is not null, n.point_kind, n.first_ready
  from public.notifications n
  join public.profiles pr on pr.id = n.actor_id
  left join public.places pl on pl.id = n.place_id
  where n.user_id = (select auth.uid())
    and public.is_live_notification(n.id)
  order by n.created_at desc
  limit least(p_limit, 100)
$$;
revoke execute on function public.my_notifications(int) from public, anon;
grant execute on function public.my_notifications(int) to authenticated;
