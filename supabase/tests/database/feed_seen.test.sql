-- 피드 구분선 기준 (70-3) — 처음은 없음 · 30분 안 새로 고침은 그대로 · 30분 뒤 새 방문이면 지난번 연 때
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('fd111111-1111-1111-1111-111111111111', 'fs-me@test.local'),
  ('fd222222-2222-2222-2222-222222222222', 'fs-other@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fd111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.open_feed(), null, '처음 열면 기준 없음');
reset role;
update public.profiles set feed_open_at = now() - interval '10 minutes', feed_seen_at = '2026-01-01' where id = 'fd111111-1111-1111-1111-111111111111';
set local role authenticated;
select is(public.open_feed(), '2026-01-01'::timestamptz, '30분 안 새로 고침은 기준 그대로');
reset role;
update public.profiles set feed_open_at = '2026-02-02', feed_seen_at = '2026-01-01' where id = 'fd111111-1111-1111-1111-111111111111';
set local role authenticated;
select is(public.open_feed(), '2026-02-02'::timestamptz, '30분 넘게 지나 다시 열면 지난번 연 때가 기준');

select set_config('request.jwt.claims', '{"sub":"fd222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$ select feed_open_at from public.profiles where id = 'fd111111-1111-1111-1111-111111111111' $$, '42501', null, '남의 연 때는 못 읽음');
reset role;
select ok((select feed_seen_at from public.profiles where id = 'fd222222-2222-2222-2222-222222222222') is null, '남의 것은 안 바뀜');

select * from finish();
rollback;
