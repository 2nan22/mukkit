-- 약속 상태 — 상대 위치 값은 숨기고 '넣었는지'와 닉네임만
create function public.meetup_status(p_meetup uuid)
returns table (
  meetup_id uuid, purpose text, status text, invite_token text, expires_at timestamptz,
  is_host boolean, partner_id uuid, partner_nickname text, me_ready boolean, partner_ready boolean
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  m as (
    select * from public.meetups
    where id = p_meetup and (select id from me) in (host_id, guest_id)
  )
  select m.id, m.purpose, m.status,
         case when m.host_id = (select id from me) then m.invite_token end,
         m.expires_at,
         m.host_id = (select id from me),
         p.id, p.nickname,
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = (select id from me)),
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = p.id)
  from m
  left join public.profiles p on p.id = case when m.host_id = (select id from me) then m.guest_id else m.host_id end;
$$;

revoke all on function public.meetup_status(uuid) from public, anon;
grant execute on function public.meetup_status(uuid) to authenticated;
