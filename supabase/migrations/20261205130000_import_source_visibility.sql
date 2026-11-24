-- 가져올 때 고른 평가 공개 범위 (68) — 새벽 새로 고침으로 새로 들어온 곳도 같은 공개 범위로
alter table public.import_sources add column visibility public.rating_visibility;
