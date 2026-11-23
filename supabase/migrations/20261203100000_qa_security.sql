-- QA 56 보안 — 링크 리스트 직접 읽기 · 차단 사이 읽기 · 차단 관계 엿보기 · 약속 참여 차단 · 프로필 칸 공개

-- 링크 공개는 id 를 아는 사람만 — 직접 읽기는 주인 · 공개(차단 사이 제외)만, 링크 리스트는 public_list 등 함수로만
drop policy "리스트 읽기" on public.lists;
create policy "리스트 읽기" on public.lists for select
  using ((select auth.uid()) = owner_id or (visibility = 'public' and not public.is_blocked((select auth.uid()), owner_id)));

-- 차단한 사이엔 팔로우 관계도 서로 안 보임
drop policy "팔로우는 누구나 읽음" on public.follows;
create policy "팔로우는 차단 사이가 아니면 읽음" on public.follows for select
  using (not public.is_blocked((select auth.uid()), follower_id) and not public.is_blocked((select auth.uid()), followee_id));

-- 차단 관계는 내가 낀 쌍만 답한다 — 남끼리의 차단은 알아낼 수 없게
create or replace function public.is_blocked(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_a is not null and p_b is not null
    and coalesce((select auth.uid()) in (p_a, p_b) or (select auth.role()) = 'service_role', false)
    and exists (
      select 1 from public.blocks b
      where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
    );
$$;

create or replace function public.profile_lists(p_owner uuid)
returns table(id uuid, name text, count integer, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.id, l.name, (select count(*)::int from public.list_items li where li.list_id = l.id), l.updated_at
  from public.lists l
  where l.owner_id = p_owner and l.visibility = 'public' and not public.is_blocked((select auth.uid()), p_owner)
  order by l.updated_at desc
$$;

-- 약속은 참여자 누구와든 서로 차단이면 참여 불가 (만든 사람만 보던 것을 넓힘)
create or replace function public.join_meetup(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  m public.meetups;
begin
  if me is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select * into m from public.meetups where invite_token = p_token and expires_at > now() and status = 'open' for update;
  if not found then raise exception 'meetup not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.meetup_members where meetup_id = m.id and user_id = me) then return m.id; end if;
  if exists (select 1 from public.meetup_members mm where mm.meetup_id = m.id and public.is_blocked(me, mm.user_id))
    or public.is_blocked(me, m.host_id) then
    raise exception 'blocked' using errcode = '42501';
  end if;
  if (select count(*) from public.meetup_members where meetup_id = m.id) >= m.max_members then
    raise exception 'meetup full' using errcode = 'P0001';
  end if;
  insert into public.meetup_members (meetup_id, user_id) values (m.id, me);
  delete from public.meetup_invites where meetup_id = m.id and user_id = me;
  return m.id;
end;
$$;

-- 가입 단계 · 알림 설정은 본인 함수로 — 공개 칸 제한은 새 코드 배포 뒤 20261203120000 에서

create function public.my_profile_flags()
returns table(nickname_set_at timestamptz, terms_version text, push_off text[])
language sql stable security definer set search_path = '' as $$
  select p.nickname_set_at, p.terms_version, p.push_off from public.profiles p where p.id = (select auth.uid())
$$;
revoke all on function public.my_profile_flags() from public, anon;
grant execute on function public.my_profile_flags() to authenticated;
