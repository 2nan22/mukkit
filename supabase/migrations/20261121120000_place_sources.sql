-- 한 장소에 출처 ID 여러 개 — 네이버 · 카카오에서 가져온 같은 가게를 하나로
create table public.place_sources (
  source text not null,
  source_place_id text not null,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source, source_place_id)
);

create index place_sources_place_idx on public.place_sources (place_id);
create index places_lat_lng_idx on public.places (lat, lng);

insert into public.place_sources (source, source_place_id, place_id)
select source, source_place_id, id from public.places;

alter table public.place_sources enable row level security;
create policy "출처 연결은 누구나 읽음" on public.place_sources for select using (true);
create policy "로그인 사용자는 출처 연결 추가" on public.place_sources for insert to authenticated with check (true);

-- 점마다 반경 안의 장소 후보 — 같은 가게인지는 앱이 이름까지 보고 정한다
create function public.places_near(points jsonb, radius_m double precision default 60)
returns table (idx int, place_id uuid, name text, lat double precision, lng double precision, source text)
language sql stable security invoker set search_path = '' as $$
  select (p ->> 'idx')::int, pl.id, pl.name, pl.lat, pl.lng, pl.source
  from jsonb_array_elements(points) p
  join public.places pl
    on pl.lat between (p ->> 'lat')::float8 - radius_m / 111000 and (p ->> 'lat')::float8 + radius_m / 111000
   and pl.lng between (p ->> 'lng')::float8 - radius_m / 88000 and (p ->> 'lng')::float8 + radius_m / 88000
$$;
