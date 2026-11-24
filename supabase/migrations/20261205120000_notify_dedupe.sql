-- 66 코드 검토 — 푸시 · 알림함 중복 막기
-- 1) 푸시를 보냈는지 — 팔로우를 빠르게 두 번 눌러도 푸시는 한 번 (조건부 update 로 한 곳만 성공)
alter table public.notifications add column pushed_at timestamptz;

-- 2) 추천 지역: 같은 사람이 위치를 지웠다 다시 넣기를 반복해도 30분 안이면 다시 울리지 않음
--    푸시는 이 트리거가 방금 만든 줄을 보고 보내므로(차단 · 끝난 약속 거르기도 같음) 같은 기준을 따른다
create or replace function public.on_meetup_point_notify() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  r record;
  ready int;
begin
  if (select count(*) from public.meetup_points p where p.meetup_id = new.meetup_id and p.user_id = new.user_id) > 1 then return new; end if;
  if not exists (select 1 from public.meetups m where m.id = new.meetup_id and m.status = 'open') then return new; end if;
  select count(distinct p.user_id) into ready from public.meetup_points p where p.meetup_id = new.meetup_id;
  if ready < 2 then return new; end if;
  for r in select distinct p.user_id from public.meetup_points p where p.meetup_id = new.meetup_id and p.user_id <> new.user_id loop
    if exists (select 1 from public.blocks b where (b.blocker_id = r.user_id and b.blocked_id = new.user_id) or (b.blocker_id = new.user_id and b.blocked_id = r.user_id)) then continue; end if;
    insert into public.notifications (user_id, kind, actor_id, meetup_id, point_kind, first_ready)
    values (r.user_id, 'meetup_ready', new.user_id, new.meetup_id, new.kind, ready = 2)
    on conflict (user_id, meetup_id) where kind = 'meetup_ready'
      do update set actor_id = excluded.actor_id, point_kind = excluded.point_kind, first_ready = excluded.first_ready, created_at = now(), read_at = null, pushed_at = null
      where not (public.notifications.actor_id = excluded.actor_id and public.notifications.created_at > now() - interval '30 minutes');
  end loop;
  return new;
end;
$$;
