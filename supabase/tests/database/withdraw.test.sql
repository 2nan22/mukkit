-- 탈퇴 — 내 계정과 내 데이터만 지운다
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('61111111-1111-1111-1111-111111111111', 'wd-a@test.local'),
  ('62222222-2222-2222-2222-222222222222', 'wd-b@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine, available) values
  ('f1111111-0000-0000-0000-000000000001', 'naver', 'wd-1', '탈퇴검사', 33.2, 126.2, 'korean', true);
insert into public.user_places (user_id, place_id, tier, visibility, sponsored, note) values
  ('61111111-1111-1111-1111-111111111111', 'f1111111-0000-0000-0000-000000000001', 'three', 'public', false, '내 메모'),
  ('62222222-2222-2222-2222-222222222222', 'f1111111-0000-0000-0000-000000000001', 'two', 'public', false, '');
insert into public.lists (id, owner_id, name) values ('f2222222-0000-0000-0000-000000000001', '61111111-1111-1111-1111-111111111111', '내 리스트');
insert into public.follows (follower_id, followee_id) values ('62222222-2222-2222-2222-222222222222', '61111111-1111-1111-1111-111111111111');

-- 로그인 안 한 상태로는 못 부른다
set local role anon;
select throws_ok('select public.delete_my_account()', '42501', null, '비로그인은 호출 불가');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok('select public.delete_my_account()', '본인 탈퇴');

reset role;
select is((select count(*)::int from auth.users where id = '61111111-1111-1111-1111-111111111111'), 0, '계정 삭제');
select is((select count(*)::int from public.user_places where user_id = '61111111-1111-1111-1111-111111111111'), 0, '평가 · 메모 연쇄 삭제');
select is((select count(*)::int from public.lists where owner_id = '61111111-1111-1111-1111-111111111111')
         + (select count(*)::int from public.follows where followee_id = '61111111-1111-1111-1111-111111111111'), 0, '리스트 · 팔로우 연쇄 삭제');
select is((select count(*)::int from public.user_places where user_id = '62222222-2222-2222-2222-222222222222')
         + (select count(*)::int from public.places where id = 'f1111111-0000-0000-0000-000000000001'), 2, '남의 평가와 공유 장소는 그대로');

select * from finish();
rollback;
