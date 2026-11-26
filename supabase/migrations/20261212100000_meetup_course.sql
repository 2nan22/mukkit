-- 84 약속 코스 — 1차 › 2차 순서로 가게를 담고, 실제 걷는 길을 저장한다 (사용자 2026-11-27 '트리플처럼')
-- 코스는 약속 참여자 모두가 같이 보고 고친다. 고치기는 set_meetup_course 하나로만(통째로 바꿈)

create table public.meetup_course (
  meetup_id uuid not null references public.meetups (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  position smallint not null check (position between 0 and 4),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (meetup_id, place_id),
  unique (meetup_id, position)
);

alter table public.meetup_course enable row level security;
create policy "코스는 참여자만 봄" on public.meetup_course for select to authenticated using (public.is_meetup_member(meetup_id));
revoke insert, update, delete on public.meetup_course from anon, authenticated;

-- 걷는 길 — 서버가 카카오에서 받아 서비스 키로만 쓴다(참여자가 길을 꾸며 넣지 못하게)
-- course_key: 이 길을 받을 때의 장소 순서. 지금 코스와 다르면 화면은 직선 어림으로
create table public.meetup_course_route (
  meetup_id uuid primary key references public.meetups (id) on delete cascade,
  course_key text not null,
  legs jsonb not null,
  path jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.meetup_course_route enable row level security;
create policy "코스 길은 참여자만 봄" on public.meetup_course_route for select to authenticated using (public.is_meetup_member(meetup_id));
revoke insert, update, delete on public.meetup_course_route from anon, authenticated;

-- 코스를 통째로 바꾼다 — 참여자만 · 최대 5곳 · 같은 곳 두 번 안 됨 · 끝난 약속은 못 고침
-- 바뀌면 저장된 길을 지운다(새 길은 서버가 받아 넣음)
create function public.set_meetup_course(p_meetup uuid, p_places uuid[])
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_key text := array_to_string(coalesce(p_places, '{}'), ',');
  v_old text;
  v_added jsonb;
begin
  if not public.is_meetup_member(p_meetup) then raise exception 'not a member' using errcode = '42501'; end if;
  if exists (select 1 from public.meetups where id = p_meetup and status <> 'open') then raise exception 'closed' using errcode = 'P0002'; end if;
  if coalesce(array_length(p_places, 1), 0) > 5 then raise exception 'too many' using errcode = 'P0001'; end if;
  if (select count(distinct x) from unnest(p_places) x) <> coalesce(array_length(p_places, 1), 0) then raise exception 'duplicate' using errcode = '22023'; end if;
  if exists (select 1 from unnest(p_places) x where not exists (select 1 from public.places p where p.id = x)) then raise exception 'no place' using errcode = '22023'; end if;

  select string_agg(place_id::text, ',' order by position) into v_old from public.meetup_course where meetup_id = p_meetup;
  if coalesce(v_old, '') = v_key then return v_key; end if;

  -- 담은 사람은 남긴다 — 순서만 바뀐 곳은 처음 담은 사람 그대로
  select coalesce(jsonb_object_agg(place_id, added_by), '{}') into v_added from public.meetup_course where meetup_id = p_meetup;
  delete from public.meetup_course where meetup_id = p_meetup;
  insert into public.meetup_course (meetup_id, place_id, position, added_by)
  select p_meetup, x, (o - 1)::smallint, coalesce((v_added ->> x::text)::uuid, (select auth.uid()))
  from unnest(p_places) with ordinality as t(x, o);
  delete from public.meetup_course_route where meetup_id = p_meetup;
  return v_key;
end
$$;
revoke all on function public.set_meetup_course(uuid, uuid[]) from public, anon;
grant execute on function public.set_meetup_course(uuid, uuid[]) to authenticated;
