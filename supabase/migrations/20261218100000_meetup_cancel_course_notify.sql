-- 약속 알림 보강 (93)
-- 1) 약속 취소를 알림함에도 — 약속은 지워지므로 약속 칸은 비우고 약속 시각만 남긴다
-- 2) 코스 변경 알림 — 약속 하나에 한 줄, 최신 내용으로 바꾸고 푸시는 30분에 한 번

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'like', 'follow', 'meetup_invite', 'meetup_join', 'meetup_ready', 'meetup_cancel', 'meetup_course', 'visit_tag'));
-- 취소된 약속의 시각 — 문구용 (어느 약속인지 알 수 있게, 장소는 싣지 않음)
alter table public.notifications add column meetup_starts_at timestamptz;
create unique index notifications_meetup_course_once on public.notifications (user_id, meetup_id) where kind = 'meetup_course';

-- 취소 — 약속을 지우기 전에 받는 사람마다 알림 줄을 남긴다 (차단한 사이는 건너뜀)
create or replace function public.cancel_meetup(p_meetup uuid)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
  v_to uuid[];
  v_starts timestamptz;
begin
  perform 1 from public.meetups where id = p_meetup for update;
  if not exists (select 1 from public.meetups where id = p_meetup and host_id = v_me) then
    raise exception 'not host' using errcode = '42501';
  end if;
  if exists (select 1 from public.meetups where id = p_meetup and status <> 'open') then
    raise exception 'closed' using errcode = 'P0002';
  end if;
  select starts_at into v_starts from public.meetups where id = p_meetup;
  select coalesce(array_agg(distinct u), '{}') into v_to from (
    select user_id u from public.meetup_members where meetup_id = p_meetup
    union select user_id from public.meetup_invites where meetup_id = p_meetup
  ) x where u <> v_me
    and not exists (select 1 from public.blocks b where (b.blocker_id = x.u and b.blocked_id = v_me) or (b.blocker_id = v_me and b.blocked_id = x.u));
  delete from public.meetups where id = p_meetup;
  insert into public.notifications (user_id, kind, actor_id, meetup_starts_at, pushed_at)
  select u, 'meetup_cancel', v_me, v_starts, now() from unnest(v_to) u;
  return query select unnest(v_to);
end
$$;

-- 코스 변경 — 바꾼 사람을 뺀 참여자에게 (초대만 받은 사람은 약속을 아직 못 봄)
-- 같은 약속은 한 줄로, 30분 안에 다시 바뀌면 푸시는 건너뛴다(pushed_at 유지)
create function public.on_meetup_course_notify(p_meetup uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, kind, actor_id, meetup_id)
  select m.user_id, 'meetup_course', p_actor, p_meetup
  from public.meetup_members m
  where m.meetup_id = p_meetup and m.user_id <> p_actor
    and not exists (select 1 from public.blocks b where (b.blocker_id = m.user_id and b.blocked_id = p_actor) or (b.blocker_id = p_actor and b.blocked_id = m.user_id))
  on conflict (user_id, meetup_id) where kind = 'meetup_course'
    do update set actor_id = excluded.actor_id, created_at = now(), read_at = null,
      pushed_at = case when notifications.pushed_at > now() - interval '30 minutes' then notifications.pushed_at end;
end
$$;
revoke execute on function public.on_meetup_course_notify(uuid, uuid) from public, anon, authenticated;

create or replace function public.set_meetup_course(p_meetup uuid, p_places uuid[], p_expected text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_key text := array_to_string(coalesce(p_places, '{}'), ',');
  v_old text;
  v_added jsonb;
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  perform 1 from public.meetups where id = p_meetup for update;
  if exists (select 1 from public.meetups where id = p_meetup and status <> 'open') then raise exception 'closed' using errcode = 'P0002'; end if;
  if coalesce(array_length(p_places, 1), 0) > 5 then raise exception 'too many' using errcode = 'P0001'; end if;
  if (select count(distinct x) from unnest(p_places) x) <> coalesce(array_length(p_places, 1), 0) then raise exception 'duplicate' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_places) x where not exists (select 1 from public.places p where p.id = x)) then raise exception 'no place' using errcode = '22023'; end if;

  select coalesce(string_agg(place_id::text, ',' order by position), '') into v_old from public.meetup_course where meetup_id = p_meetup;
  if v_old = v_key then return false; end if;
  if p_expected is not null and p_expected <> v_old then raise exception 'changed by other' using errcode = 'P0003'; end if;

  -- 담은 사람은 남긴다 — 순서만 바뀐 곳은 처음 담은 사람 그대로
  select coalesce(jsonb_object_agg(place_id, added_by), '{}') into v_added from public.meetup_course where meetup_id = p_meetup;
  delete from public.meetup_course where meetup_id = p_meetup;
  insert into public.meetup_course (meetup_id, place_id, position, added_by)
  select p_meetup, x, (o - 1)::smallint, coalesce((v_added ->> x::text)::uuid, (select auth.uid()))
  from unnest(p_places) with ordinality as t(x, o);
  delete from public.meetup_course_route where meetup_id = p_meetup;
  perform public.on_meetup_course_notify(p_meetup, (select auth.uid()));
  return true;
end
$$;

-- 알림함 — 취소된 약속 시각을 함께 (반환 칸이 바뀌어 다시 만든다)
drop function public.my_notifications(int);
create function public.my_notifications(p_limit int default 50)
returns table (id uuid, kind text, actor_id uuid, actor_nickname text, owner_id uuid, place_id uuid, place_name text, meetup_id uuid, visit_id uuid, created_at timestamptz, read boolean, point_kind text, first_ready boolean, meetup_starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.actor_id, pr.nickname, n.owner_id, n.place_id, pl.name, n.meetup_id, n.visit_id, n.created_at, n.read_at is not null, n.point_kind, n.first_ready, n.meetup_starts_at
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

-- 나가면 내가 바꾼 코스 알림도 남의 알림함에서 정리 — 참여 알림과 같은 규칙 (93 검토)
create or replace function public.leave_meetup(p_meetup uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
begin
  if not exists (select 1 from public.meetup_members where meetup_id = p_meetup and user_id = v_me) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if exists (select 1 from public.meetups where id = p_meetup and host_id = v_me) then
    raise exception 'host cannot leave' using errcode = '42501';
  end if;
  if exists (select 1 from public.meetups where id = p_meetup and status <> 'open') then
    raise exception 'closed' using errcode = 'P0002';
  end if;
  delete from public.meetup_points where meetup_id = p_meetup and user_id = v_me;
  delete from public.meetup_members where meetup_id = p_meetup and user_id = v_me;
  delete from public.notifications where meetup_id = p_meetup and (user_id = v_me or (kind in ('meetup_join', 'meetup_course') and actor_id = v_me));
end
$$;
