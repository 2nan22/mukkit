-- 새벽 작업(폐업 확인 등) 실행 기록 — 서버 크론만 쓴다 (서비스 키), 사용자는 읽지도 쓰지도 못함
create table public.job_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  checked int not null default 0,
  closed int not null default 0,
  reopened int not null default 0,
  detail jsonb not null default '{}'::jsonb,
  error text
);

alter table public.job_runs enable row level security;
-- 정책 없음: anon · authenticated 는 접근 불가, service_role 은 RLS 를 건너뜀

create index job_runs_job_started_idx on public.job_runs (job, started_at desc);
create index places_source_checked_idx on public.places (source_checked_at);
