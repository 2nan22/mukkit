-- 가져올 때 '지도 앱 메모를 한 줄 평가로도 보여 주기'를 골랐는지 (68-3) — 새벽 새로 고침으로 새로 들어온 곳도 같은 선택으로
alter table public.import_sources add column memo_to_review boolean not null default false;
