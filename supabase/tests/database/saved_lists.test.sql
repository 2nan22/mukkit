-- 남의 리스트 저장 — 링크 · 공개만 · 내 것 불가 · 저장 수 · 새로 추가된 곳 · 차단 정리
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('f1111111-1111-1111-1111-111111111111', 'sl-a@test.local'),
  ('f2222222-2222-2222-2222-222222222222', 'sl-b@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('a9600000-0000-0000-0000-000000000001', 'kakao', 'sl-1', '저장검사1', 37.5, 127.0, 'korean'),
  ('a9600000-0000-0000-0000-000000000002', 'kakao', 'sl-2', '저장검사2', 37.5, 127.0, 'korean');
insert into public.lists (id, owner_id, name, visibility) values
  ('b9600000-0000-0000-0000-000000000001', 'f1111111-1111-1111-1111-111111111111', '공개리스트', 'public'),
  ('b9600000-0000-0000-0000-000000000002', 'f1111111-1111-1111-1111-111111111111', '비공개리스트', 'private');
insert into public.list_items (list_id, place_id, added_at) values ('b9600000-0000-0000-0000-000000000001', 'a9600000-0000-0000-0000-000000000001', now() - interval '1 day');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$insert into public.saved_lists (user_id, list_id) values ('f2222222-2222-2222-2222-222222222222', 'b9600000-0000-0000-0000-000000000001')$$, '공개 리스트 저장');
select throws_ok($$insert into public.saved_lists (user_id, list_id) values ('f2222222-2222-2222-2222-222222222222', 'b9600000-0000-0000-0000-000000000002')$$, '42501', null, '비공개 리스트는 저장 못 함');
select is((select row(saves, saved, mine)::text from public.list_meta('b9600000-0000-0000-0000-000000000001')), '(1,t,f)', '저장 수 1 · 내가 저장함');

select set_config('request.jwt.claims', '{"sub":"f1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$insert into public.saved_lists (user_id, list_id) values ('f1111111-1111-1111-1111-111111111111', 'b9600000-0000-0000-0000-000000000001')$$, '42501', null, '내 리스트는 저장 못 함');
select is((select count(*)::int from public.saved_lists), 0, '남이 저장한 기록은 주인에게도 안 보임 (숫자만)');

-- 주인이 새로 담으면 '새로 추가된 곳'
reset role;
update public.saved_lists set last_seen_at = now() - interval '1 hour';
insert into public.list_items (list_id, place_id) values ('b9600000-0000-0000-0000-000000000001', 'a9600000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select row(count, new_count)::text from public.my_saved_lists()), '(2,1)', '2곳 중 새로 추가된 곳 1');

-- 비공개로 바뀌면 목록에서 빠짐
reset role;
update public.lists set visibility = 'private' where id = 'b9600000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.my_saved_lists()), 0, '비공개로 바뀐 리스트는 안 보임');

-- 차단하면 저장 정리
reset role;
update public.lists set visibility = 'public' where id = 'b9600000-0000-0000-0000-000000000001';
insert into public.blocks (blocker_id, blocked_id) values ('f1111111-1111-1111-1111-111111111111', 'f2222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.saved_lists where user_id = 'f2222222-2222-2222-2222-222222222222'), 0, '차단하면 저장도 지움');

select * from finish();
rollback;
