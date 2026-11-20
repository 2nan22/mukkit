-- 장소 평가 · 리스트 공유 기본 스키마
-- 원칙: 가게 단위 집계(평균 점수 등) 컬럼 · 뷰를 만들지 않는다 (CLAUDE.md 비협상 목표 2)

create type public.tier as enum ('three', 'two', 'one', 'not_recommended', 'want_to_go', 'unrated');
create type public.list_visibility as enum ('private', 'link', 'public');

-- 공개 프로필
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 30),
  bio text check (char_length(bio) <= 150),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 장소 정규형 — 출처 + 출처 ID 로 하나
create table public.places (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_place_id text not null,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text not null default '',
  category_path text[] not null default '{}',
  cuisine text not null,
  created_at timestamptz not null default now(),
  unique (source, source_place_id)
);

-- 사용자별 저장 상태 · 등급 (평가는 선택 — 기본값 평가 전)
create table public.user_places (
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  tier public.tier not null default 'unrated',
  note text not null default '' check (char_length(note) <= 300),
  visited_on date,
  sponsored boolean not null default false,
  saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  description text not null default '' check (char_length(description) <= 200),
  visibility public.list_visibility not null default 'private',
  source text,
  source_list_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, place_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index user_places_place_idx on public.user_places (place_id);
create index lists_owner_idx on public.lists (owner_id);
create index list_items_place_idx on public.list_items (place_id);
create index follows_followee_idx on public.follows (followee_id);

-- 가입 시 프로필 생성
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), '사용자 ' || left(new.id::text, 6)), 30)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.user_places enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.follows enable row level security;

create policy "프로필은 누구나 읽음" on public.profiles for select using (true);
create policy "프로필은 본인만 수정" on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "장소는 누구나 읽음" on public.places for select using (true);
create policy "로그인 사용자는 장소 추가" on public.places for insert to authenticated with check (true);

-- 남에게는 평가만 보이고, 저장 · 가고 싶은 곳 · 평가 전은 본인만
create policy "본인 저장은 전부 읽음" on public.user_places for select
  using ((select auth.uid()) = user_id);
create policy "남의 평가는 평가된 것만 읽음" on public.user_places for select
  using (tier in ('three', 'two', 'one', 'not_recommended'));
create policy "본인 저장만 추가" on public.user_places for insert
  with check ((select auth.uid()) = user_id);
create policy "본인 저장만 수정" on public.user_places for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "본인 저장만 삭제" on public.user_places for delete
  using ((select auth.uid()) = user_id);

-- link 공개는 링크(아이디)를 아는 사람이 읽음 — 목록 노출은 public 만 (조회 쿼리에서 거름)
create policy "리스트 읽기" on public.lists for select
  using ((select auth.uid()) = owner_id or visibility in ('link', 'public'));
create policy "본인 리스트만 추가" on public.lists for insert
  with check ((select auth.uid()) = owner_id);
create policy "본인 리스트만 수정" on public.lists for update
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "본인 리스트만 삭제" on public.lists for delete
  using ((select auth.uid()) = owner_id);

create policy "읽을 수 있는 리스트의 항목 읽기" on public.list_items for select
  using (exists (select 1 from public.lists l where l.id = list_id));
create policy "본인 리스트에만 항목 추가" on public.list_items for insert
  with check (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())));
create policy "본인 리스트에서만 항목 삭제" on public.list_items for delete
  using (exists (select 1 from public.lists l where l.id = list_id and l.owner_id = (select auth.uid())));

create policy "팔로우는 누구나 읽음" on public.follows for select using (true);
create policy "본인 팔로우만 추가" on public.follows for insert
  with check ((select auth.uid()) = follower_id);
create policy "본인 팔로우만 삭제" on public.follows for delete
  using ((select auth.uid()) = follower_id);
