-- 네이버 세부 업종 이름 · 폐업 여부 — 폐업 여부는 주기적으로 다시 확인해 갱신
alter table public.places
  add column category_name text not null default '',
  add column available boolean not null default true,
  add column source_checked_at timestamptz not null default now();
