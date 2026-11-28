-- 약속 이름을 상태 · 링크 초대 함수에서도 돌려준다 (96) — 링크로 연 사람은 아직 참여자가 아니라 표를 직접 못 읽음
drop function public.meetup_status(uuid);
drop function public.meetup_invite(text);

create function public.meetup_status(p_meetup uuid)
returns table (
  meetup_id uuid, purpose text, status text, invite_token text, expires_at timestamptz, starts_at timestamptz, ends_at timestamptz,
  max_members int, is_host boolean, is_member boolean, is_invitee boolean, host_nickname text, me_ready boolean,
  members jsonb, invitees jsonb, title text
)
language sql stable security definer set search_path = '' as $$
  with me as (select (select auth.uid()) as id),
  m as (
    select * from public.meetups mt
    where mt.id = p_meetup
      and (exists (select 1 from public.meetup_members mm where mm.meetup_id = mt.id and mm.user_id = (select id from me))
           or exists (select 1 from public.meetup_invites mi where mi.meetup_id = mt.id and mi.user_id = (select id from me)))
  )
  select m.id, m.purpose, m.status,
         case when m.host_id = (select id from me) then m.invite_token end,
         m.expires_at, m.starts_at, m.ends_at, m.max_members,
         m.host_id = (select id from me),
         exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select id from me)),
         exists (select 1 from public.meetup_invites mi where mi.meetup_id = m.id and mi.user_id = (select id from me)),
         (select p.nickname from public.profiles p where p.id = m.host_id),
         exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = (select id from me)),
         -- 참여자 목록은 참여자에게만
         case when exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select id from me)) then
           (select coalesce(jsonb_agg(jsonb_build_object(
              'id', p.id, 'nickname', p.nickname, 'isHost', p.id = m.host_id, 'isMe', p.id = (select id from me),
              'ready', exists (select 1 from public.meetup_points mp where mp.meetup_id = m.id and mp.user_id = p.id)
            ) order by mm.joined_at), '[]'::jsonb)
            from public.meetup_members mm join public.profiles p on p.id = mm.user_id where mm.meetup_id = m.id)
         else '[]'::jsonb end,
         case when m.host_id = (select id from me) then
           (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname) order by mi.created_at), '[]'::jsonb)
            from public.meetup_invites mi join public.profiles p on p.id = mi.user_id where mi.meetup_id = m.id)
         else '[]'::jsonb end,
         m.title
  from m;
$$;

create function public.meetup_invite(p_token text)
returns table (meetup_id uuid, host_nickname text, purpose text, status text, starts_at timestamptz, ends_at timestamptz,
               member_count int, joined boolean, is_host boolean, full boolean, title text)
language sql stable security definer set search_path = '' as $$
  select m.id, p.nickname, m.purpose, m.status, m.starts_at, m.ends_at,
         (select count(*)::int from public.meetup_members mm where mm.meetup_id = m.id),
         exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select auth.uid())),
         (select auth.uid()) = m.host_id,
         (select count(*) from public.meetup_members mm where mm.meetup_id = m.id) >= m.max_members
           and not exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and mm.user_id = (select auth.uid())),
         m.title
  from public.meetups m join public.profiles p on p.id = m.host_id
  where m.invite_token = p_token and m.expires_at > now();
$$;
revoke all on function public.meetup_status(uuid) from public, anon;
grant execute on function public.meetup_status(uuid) to authenticated;
revoke all on function public.meetup_invite(text) from public;
grant execute on function public.meetup_invite(text) to anon, authenticated;
