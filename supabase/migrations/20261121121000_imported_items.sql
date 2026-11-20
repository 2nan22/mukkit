-- 가져온 원본 항목 — 플랫폼 · 리스트별 메모 · 라벨(리스트 이름) · 원본 응답을 그대로 보관 (본인만)
create table public.imported_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null,
  source_list_id text not null,
  source_place_id text not null,
  place_id uuid not null references public.places (id) on delete cascade,
  list_name text not null default '',
  memo text not null default '',
  category_name text not null default '',
  category_path text[] not null default '{}',
  saved_at timestamptz,
  raw jsonb not null default '{}',
  imported_at timestamptz not null default now(),
  primary key (user_id, source, source_list_id, source_place_id)
);

create index imported_items_place_idx on public.imported_items (user_id, place_id);

alter table public.imported_items enable row level security;
create policy "본인 원본만 읽음" on public.imported_items for select using ((select auth.uid()) = user_id);
create policy "본인 원본만 추가" on public.imported_items for insert with check ((select auth.uid()) = user_id);
create policy "본인 원본만 수정" on public.imported_items for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 원본만 삭제" on public.imported_items for delete using ((select auth.uid()) = user_id);

-- 출처마다 가게 이름 · 업종이 다를 수 있어 출처 연결에도 남긴다 (공용 정보)
alter table public.place_sources
  add column name text not null default '',
  add column category_name text not null default '',
  add column category_path text[] not null default '{}';
update public.place_sources ps
  set name = pl.name, category_name = pl.category_name, category_path = pl.category_path
  from public.places pl where pl.id = ps.place_id;
