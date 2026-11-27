-- 약속 취소 검토 반영 (90-2) — 취소 · 나가기 함수를 우회하던 옛 통로 막기, 나간 사람 알림 정리

-- 1) 상태는 함수로만 — 참여자가 REST 로 status 를 'cancelled' 로 바꾸거나 끝난 약속을 다시 열던 길
revoke update (status) on public.meetups from authenticated;

create function public.finish_meetup(p_meetup uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  update public.meetups set status = 'done' where id = p_meetup and status = 'open';
  if not found then raise exception 'closed' using errcode = 'P0002'; end if;
  -- 끝낸 약속의 위치는 바로 지운다 (새벽 정리 작업은 남은 것 정리용)
  delete from public.meetup_points where meetup_id = p_meetup;
end
$$;
revoke all on function public.finish_meetup(uuid) from public, anon;
grant execute on function public.finish_meetup(uuid) to authenticated;

-- 2) 나가기는 함수로만 — 직접 지우면 위치가 남아 지역 계산에 계속 들어감
drop policy "참여자는 스스로 나갈 수 있음" on public.meetup_members;

-- 3) 나가면 그 약속 알림도 정리 — 내 알림함의 약속 알림 · 남의 알림함의 '○○님이 참여했어요'
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
  delete from public.notifications where meetup_id = p_meetup and (user_id = v_me or (kind = 'meetup_join' and actor_id = v_me));
end
$$;

-- 4) 취소 — 약속 줄을 먼저 잠가 그 사이 들어온 사람도 알림 대상에
create or replace function public.cancel_meetup(p_meetup uuid)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  v_to uuid[];
begin
  perform 1 from public.meetups where id = p_meetup for update;
  if not exists (select 1 from public.meetups where id = p_meetup and host_id = (select auth.uid())) then
    raise exception 'not host' using errcode = '42501';
  end if;
  if exists (select 1 from public.meetups where id = p_meetup and status <> 'open') then
    raise exception 'closed' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(distinct u), '{}') into v_to from (
    select user_id u from public.meetup_members where meetup_id = p_meetup
    union select user_id from public.meetup_invites where meetup_id = p_meetup
  ) x where u <> (select auth.uid());
  delete from public.meetups where id = p_meetup;
  return query select unnest(v_to);
end
$$;
