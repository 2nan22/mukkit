-- 앱 안에서 사용자를 바로 초대 — 받은 사람이 수락하면 손님, 거절하면 빠짐 (링크 초대는 그대로)
alter table public.meetups
  add column invitee_id uuid references public.profiles (id) on delete set null,
  add constraint meetups_invitee_not_host check (invitee_id is null or invitee_id <> host_id);
create index meetups_invitee_idx on public.meetups (invitee_id);

-- 받은 초대도 볼 수 있게
drop policy "약속은 당사자만 봄" on public.meetups;
create policy "약속은 당사자 · 초대받은 사람만 봄" on public.meetups for select to authenticated
  using ((select auth.uid()) in (host_id, guest_id, invitee_id));

-- 초대 · 손님 칸은 함수로만 바꾼다 — 직접 수정은 시간 · 상태만
drop policy "약속 수정은 당사자만" on public.meetups;
create policy "약속 수정은 당사자만" on public.meetups for update to authenticated
  using ((select auth.uid()) in (host_id, guest_id))
  with check ((select auth.uid()) in (host_id, guest_id));
revoke update on public.meetups from authenticated;
grant update (purpose, starts_at, ends_at, status) on public.meetups to authenticated;

-- 만든 사람이 사용자를 초대 (손님이 아직 없을 때)
create function public.invite_to_meetup(p_meetup uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.meetups where id = p_meetup and host_id = me and guest_id is null and status = 'open' and expires_at > now()) then
    raise exception 'cannot invite' using errcode = '42501';
  end if;
  if p_user = me or not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'bad invitee' using errcode = '22023';
  end if;
  update public.meetups set invitee_id = p_user where id = p_meetup;
end;
$$;

-- 초대받은 사람의 수락 · 거절
create function public.respond_meetup_invite(p_meetup uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if not exists (select 1 from public.meetups where id = p_meetup and invitee_id = me) then
    raise exception 'not invited' using errcode = '42501';
  end if;
  if p_accept then
    update public.meetups set guest_id = me, invitee_id = null
    where id = p_meetup and guest_id is null and status = 'open' and expires_at > now();
    if not found then raise exception 'meetup full' using errcode = 'P0001'; end if;
  else
    update public.meetups set invitee_id = null where id = p_meetup;
  end if;
end;
$$;

-- 링크로 다른 사람이 먼저 들어오면 남은 초대는 정리
create or replace function public.join_meetup(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.meetups;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into m from public.meetups where invite_token = p_token and expires_at > now() and status = 'open' for update;
  if not found then raise exception 'meetup not found' using errcode = 'P0002'; end if;
  if m.host_id = me or m.guest_id = me then return m.id; end if;
  if m.guest_id is not null then raise exception 'meetup full' using errcode = 'P0001'; end if;
  update public.meetups set guest_id = me, invitee_id = null where id = m.id;
  return m.id;
end;
$$;

drop function public.meetup_status(uuid);
create function public.meetup_status(p_meetup uuid)
returns table (
  meetup_id uuid, purpose text, status text, invite_token text, expires_at timestamptz, starts_at timestamptz, ends_at timestamptz,
  is_host boolean, is_invitee boolean, host_nickname text, invitee_nickname text,
  partner_id uuid, partner_nickname text, me_ready boolean, partner_ready boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  m as (
    select * from public.meetups
    where id = p_meetup and (select id from me) in (host_id, guest_id, invitee_id)
  )
  select m.id, m.purpose, m.status,
         case when m.host_id = (select id from me) then m.invite_token end,
         m.expires_at, m.starts_at, m.ends_at,
         m.host_id = (select id from me),
         coalesce(m.invitee_id = (select id from me), false),
         h.nickname,
         case when m.host_id = (select id from me) then i.nickname end,
         p.id, p.nickname,
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = (select id from me)),
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = p.id)
  from m
  join public.profiles h on h.id = m.host_id
  left join public.profiles i on i.id = m.invitee_id
  left join public.profiles p on p.id = case when m.host_id = (select id from me) then m.guest_id when m.guest_id = (select id from me) then m.host_id end;
$$;

revoke all on function public.invite_to_meetup(uuid, uuid) from public, anon;
revoke all on function public.respond_meetup_invite(uuid, boolean) from public, anon;
revoke all on function public.meetup_status(uuid) from public, anon;
grant execute on function public.invite_to_meetup(uuid, uuid) to authenticated;
grant execute on function public.respond_meetup_invite(uuid, boolean) to authenticated;
grant execute on function public.meetup_status(uuid) to authenticated;
