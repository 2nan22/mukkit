-- 연말 결산 (94)
-- 1) 결산이 나왔다는 알림함 한 줄 — 보낸 사람 없이 나에게 (actor 는 나 자신), 한 사람에 한 줄
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('comment', 'like', 'follow', 'meetup_invite', 'meetup_join', 'meetup_ready', 'meetup_cancel', 'meetup_course', 'visit_tag', 'recap'));
alter table public.notifications drop constraint notifications_check;
alter table public.notifications add constraint notifications_check check (user_id <> actor_id or kind = 'recap');
-- 90일 정리가 지우므로 해마다 새로 들어간다
create unique index notifications_recap_once on public.notifications (user_id) where kind = 'recap';

-- 결산 철(한국 시간 12 · 1월)이고 그해 평가한 곳이 있으면 알림 한 줄 — 홈을 열 때 부른다
create function public.claim_recap_notice() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := (select auth.uid());
  v_now timestamp := now() at time zone 'Asia/Seoul';
  v_year int := extract(year from v_now)::int - case when extract(month from v_now) = 1 then 1 else 0 end;
begin
  if v_me is null or extract(month from v_now) not in (12, 1) then return false; end if;
  if not exists (
    select 1 from public.user_places up
    where up.user_id = v_me and up.tier in ('three', 'two', 'one', 'not_recommended')
      and up.rated_at >= make_timestamptz(v_year, 1, 1, 0, 0, 0, 'Asia/Seoul')
      and up.rated_at < make_timestamptz(v_year + 1, 1, 1, 0, 0, 0, 'Asia/Seoul')
  ) then return false; end if;
  insert into public.notifications (user_id, kind, actor_id) values (v_me, 'recap', v_me)
  on conflict (user_id) where kind = 'recap' do nothing;
  return found;
end
$$;
revoke all on function public.claim_recap_notice() from public, anon;
grant execute on function public.claim_recap_notice() to authenticated;

-- 2) 그해 함께 간 사람 상위 3 — 내가 만들었거나 수락한 방문에서, 수락한 먹킷 사용자 · 내가 적은 이름 메모
-- 방문일(없으면 기록한 날, 한국 시간)로 해를 정한다 · 차단한 사이는 뺀다 · 나만 본다
create function public.my_recap_companions(p_year int)
returns table (user_id uuid, name text, visits int)
language sql stable security definer set search_path = '' as $$
  with mine as (
    select v.id, v.created_by
    from public.visits v
    where coalesce(v.visited_on, (v.created_at at time zone 'Asia/Seoul')::date) between make_date(p_year, 1, 1) and make_date(p_year, 12, 31)
      and (v.created_by = (select auth.uid())
        or exists (select 1 from public.visit_members m where m.visit_id = v.id and m.user_id = (select auth.uid()) and m.status = 'accepted'))
  ), people as (
    -- 함께 태그된 사람(수락) · 내가 적은 이름 메모
    select m.visit_id, m.user_id, case when m.user_id is null then btrim(m.guest_name) end as guest
    from mine x join public.visit_members m on m.visit_id = x.id
    where m.status = 'accepted' and (m.user_id is null or m.user_id <> (select auth.uid()))
      and (m.user_id is not null or x.created_by = (select auth.uid()))
    union
    -- 남이 만든 방문이면 만든 사람도 함께 간 사람
    select x.id, x.created_by, null from mine x where x.created_by <> (select auth.uid())
  )
  select p.user_id, coalesce(pr.nickname, p.guest) as name, count(distinct p.visit_id)::int as visits
  from people p
  left join public.profiles pr on pr.id = p.user_id
  where p.user_id is null or p.user_id not in (select public.my_block_ids())
  group by p.user_id, coalesce(pr.nickname, p.guest)
  having coalesce(pr.nickname, p.guest) is not null
  order by visits desc, name
  limit 3
$$;
revoke all on function public.my_recap_companions(int) from public, anon;
grant execute on function public.my_recap_companions(int) to authenticated;
