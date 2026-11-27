-- 약속 취소 다시 짜기 (90, 사용자 '상대가 수락 안 한 상태에서 취소해도 안 없어짐 · 취소 로직 전면 검토')
-- 전: 취소는 status 만 'cancelled' 로 바꿔 목록 · 받은 초대 · 알림함에 그대로 남음
-- 후: 만든 사람의 취소는 약속을 지운다(초대 · 참여 · 위치 · 코스 · 알림 연쇄 삭제, 방문 기록은 약속 연결만 끊김)
--     함께하는 사람은 '나가기'(내 참여 · 위치만 지움) · 초대받은 사람은 '거절'(그대로)

-- 이미 취소된 약속은 지운다
delete from public.meetups where status = 'cancelled';

-- 만든 사람만 · 진행 중인 약속만. 알릴 사람(참여자 · 대기 중 초대, 나 빼고)을 돌려준다
create function public.cancel_meetup(p_meetup uuid)
returns setof uuid language plpgsql security definer set search_path = '' as $$
declare
  v_to uuid[];
begin
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
revoke all on function public.cancel_meetup(uuid) from public, anon;
grant execute on function public.cancel_meetup(uuid) to authenticated;

-- 함께하는 사람이 나가기 — 만든 사람은 못 나감(취소로) · 진행 중인 약속만. 내 위치도 지운다
create function public.leave_meetup(p_meetup uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.meetup_members where meetup_id = p_meetup and user_id = (select auth.uid())) then
    raise exception 'not a member' using errcode = '42501';
  end if;
  if exists (select 1 from public.meetups where id = p_meetup and host_id = (select auth.uid())) then
    raise exception 'host cannot leave' using errcode = '42501';
  end if;
  if exists (select 1 from public.meetups where id = p_meetup and status <> 'open') then
    raise exception 'closed' using errcode = 'P0002';
  end if;
  delete from public.meetup_points where meetup_id = p_meetup and user_id = (select auth.uid());
  delete from public.meetup_members where meetup_id = p_meetup and user_id = (select auth.uid());
end
$$;
revoke all on function public.leave_meetup(uuid) from public, anon;
grant execute on function public.leave_meetup(uuid) to authenticated;
