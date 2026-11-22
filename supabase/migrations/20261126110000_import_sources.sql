-- 가져온 리스트 자동 새로 고침 (25-2) — 원본(네이버 · 카카오)을 다시 읽어 빠진 곳 · 새 곳 · 바뀐 메모를 반영
-- 가져올 때 고른 방식(그냥 저장한 리스트 / 등급 리스트)과 마지막 확인 상태를 리스트마다 남긴다
create table public.import_sources (
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('naver', 'kakao')),
  source_list_id text not null,
  mode text not null check (mode in ('plain', 'tier')),
  tier public.tier,
  list_name text not null default '',
  -- 원본 응답 요약 해시 — 같으면 아무것도 바꾸지 않는다
  last_hash text,
  last_synced_at timestamptz,
  -- ok · unavailable(비공개 · 삭제) · error(일시 실패)
  status text not null default 'ok' check (status in ('ok', 'unavailable', 'error')),
  fail_count int not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, source, source_list_id),
  check ((mode = 'tier') = (tier is not null))
);
alter table public.import_sources enable row level security;
create policy "가져온 리스트 기록은 내 것만 봄" on public.import_sources for select to authenticated using (user_id = (select auth.uid()));
create policy "가져온 리스트 기록은 내가 씀" on public.import_sources for insert to authenticated with check (user_id = (select auth.uid()));
create policy "가져온 리스트 기록은 내가 고침" on public.import_sources for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "가져온 리스트 기록은 내가 지움" on public.import_sources for delete to authenticated using (user_id = (select auth.uid()));

-- 이미 가져온 리스트 채우기 — 마이슐랭 리스트가 있으면 '그냥 저장', 없으면 등급 리스트(그 장소들에 가장 많은 등급)
insert into public.import_sources (user_id, source, source_list_id, mode, tier, list_name, last_synced_at)
select g.user_id, g.source, g.source_list_id,
       case when l.id is not null then 'plain' else 'tier' end,
       case when l.id is not null then null
            else coalesce((
              select up.tier from public.imported_items ii
              join public.user_places up on up.user_id = ii.user_id and up.place_id = ii.place_id
              where ii.user_id = g.user_id and ii.source = g.source and ii.source_list_id = g.source_list_id and up.tier <> 'unrated'
              group by up.tier order by count(*) desc limit 1), 'want_to_go') end,
       g.list_name, g.imported_at
from (
  select user_id, source, source_list_id, max(list_name) as list_name, max(imported_at) as imported_at
  from public.imported_items group by user_id, source, source_list_id
) g
left join public.lists l on l.owner_id = g.user_id and l.source = g.source and l.source_list_id = g.source_list_id
on conflict do nothing;

-- 새벽 작업이 고를 차례 — 최근 30일 안에 로그인한 사람 것만, 오래 확인 안 한 순
-- 볼 수 없는 원본은 7일에 한 번만 다시, 연속 5번 실패하면 멈춤(직접 새로 고치면 다시 시작)
create function public.import_sources_due(p_limit int)
returns table (user_id uuid, source text, source_list_id text, mode text, tier public.tier)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.source, s.source_list_id, s.mode, s.tier
  from public.import_sources s
  join auth.users u on u.id = s.user_id
  where u.last_sign_in_at > now() - interval '30 days'
    and s.fail_count < 5
    and (s.last_synced_at is null or s.last_synced_at < now() - interval '20 hours')
    and (s.status <> 'unavailable' or s.last_synced_at < now() - interval '7 days')
  order by s.last_synced_at nulls first
  limit least(p_limit, 500)
$$;
revoke execute on function public.import_sources_due(int) from public, anon, authenticated;
