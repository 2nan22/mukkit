-- RLS: 남의 저장 · 비공개 리스트를 읽거나 쓸 수 없는지
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'a@test.local', '{"name":"에이"}'),
  ('22222222-2222-2222-2222-222222222222', 'b@test.local', '{}');

select is((select count(*)::int from public.profiles where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')), 2, '가입 시 프로필 자동 생성');
select is(
  (select nickname from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '사용자22222222', '가입 시 겹치지 않는 기본 닉네임 (공급자 이름은 쓰지 않음)');
select is(
  (select nickname_set_at from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null, '닉네임 직접 정하기 전 상태');
update public.profiles set nickname = 'Mango', nickname_set_at = now()
  where id = '11111111-1111-1111-1111-111111111111';

insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'naver', 'p1', '장소1', 37.5, 127.0, 'korean'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'naver', 'p2', '장소2', 37.5, 127.0, 'cafe');
insert into public.user_places (user_id, place_id, tier) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'three'),
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', 'want_to_go');
insert into public.lists (id, owner_id, name, visibility) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '비공개', 'private'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '링크 공개', 'link');
insert into public.list_items (list_id, place_id) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000002');
insert into public.imported_items (user_id, source, source_list_id, source_place_id, place_id, list_name, memo) values
  ('11111111-1111-1111-1111-111111111111', 'naver', 'list-a', 'p1', 'aaaaaaaa-0000-0000-0000-000000000001', '난슐랭 3star', '개인 메모');

-- 사용자 B 로 접속
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.user_places where user_id = '11111111-1111-1111-1111-111111111111'),
  0, '남의 저장 줄(메모 포함)은 직접 읽을 수 없음');
update public.user_places set note = '변조' where user_id = '11111111-1111-1111-1111-111111111111';
select is(
  (select array_agg(tier::text order by name) from public.public_list('bbbbbbbb-0000-0000-0000-000000000002')),
  array[null::text], '공개 통로는 평가된 등급만 (가고 싶은 곳은 비움)');
select is(
  (select count(*)::int from public.public_list('bbbbbbbb-0000-0000-0000-000000000001')),
  0, '비공개 리스트는 공개 통로로도 안 보임');
select throws_ok(
  $$insert into public.user_places (user_id, place_id) values
    ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null, '남 명의 저장 추가 불가');
select throws_ok(
  $$insert into public.places (source, source_place_id, name, lat, lng, cuisine) values ('kakao', 'fake-1', '가짜 가게', 37.5, 127, 'korean')$$,
  '42501', null, '로그인 사용자도 장소는 직접 추가 불가 (서버만)');
select throws_ok(
  $$insert into public.place_sources (source, source_place_id, place_id) values ('kakao', 'fake-1', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null, '출처 연결도 직접 추가 불가');
select throws_ok(
  $$update public.places set name = '변조' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null, '장소 이름도 직접 고칠 수 없음');
select is(
  (select array_agg(name) from public.lists where owner_id = '11111111-1111-1111-1111-111111111111'),
  array['링크 공개'], '비공개 리스트는 안 보임');
select is(
  (select count(*)::int from public.list_items where list_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  0, '비공개 리스트 항목도 안 보임');
select throws_ok(
  $$insert into public.list_items (list_id, place_id) values
    ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001')$$,
  '42501', null, '남의 리스트에 항목 추가 불가');
update public.profiles set nickname = '변조' where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select nickname from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Mango', '남의 프로필 수정 불가');
select lives_ok(
  $$update public.profiles set nickname = '맛집탐험가', nickname_set_at = now()
    where id = '22222222-2222-2222-2222-222222222222'$$,
  '본인 닉네임은 정할 수 있음');
select throws_ok(
  $$update public.profiles set nickname = 'mango' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23505', null, '남이 쓰는 닉네임은 대소문자가 달라도 불가');
select throws_ok(
  $$update public.profiles set nickname = '가' where id = '22222222-2222-2222-2222-222222222222'$$,
  '23514', null, '닉네임은 2자 이상');
select throws_ok(
  $$insert into public.follows (follower_id, followee_id) values
    ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, '남 명의 팔로우 불가');
select lives_ok(
  $$insert into public.follows (follower_id, followee_id) values
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$,
  '본인 팔로우는 가능');
select lives_ok(
  $$insert into public.user_places (user_id, place_id, tier) values
    ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'unrated')$$,
  '본인 저장은 가능');
select throws_ok(
  $$insert into public.lists (owner_id, name, source, source_list_id) values
    ('22222222-2222-2222-2222-222222222222', '가져온 리스트', 'naver', 'share-1'),
    ('22222222-2222-2222-2222-222222222222', '가져온 리스트 사본', 'naver', 'share-1')$$,
  '23505', null, '같은 출처 리스트는 한 사람에게 하나');
select is((select count(*)::int from public.imported_items), 0, '남이 가져온 원본(메모 · 리스트 이름)은 안 보임');
select throws_ok(
  $$insert into public.imported_items (user_id, source, source_list_id, source_place_id, place_id)
    values ('11111111-1111-1111-1111-111111111111', 'naver', 'x', 'p2', 'aaaaaaaa-0000-0000-0000-000000000002')$$,
  '42501', null, '남의 이름으로 원본을 넣을 수 없음');

-- 비로그인
reset role;
select is(
  (select note from public.user_places where user_id = '11111111-1111-1111-1111-111111111111' and tier = 'three'),
  '', '남의 평가 수정 불가');

set local role anon;
select is(
  (select list_name from public.public_list('bbbbbbbb-0000-0000-0000-000000000002') limit 1),
  '링크 공개', '비로그인도 링크 리스트는 공개 통로로 읽음');
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*)::int from public.places where id::text like 'aaaaaaaa-%'), 2, '비로그인도 장소는 읽음');
select is((select array_agg(name) from public.lists where owner_id = '11111111-1111-1111-1111-111111111111'), array['링크 공개'], '비로그인은 공개 리스트만');

select * from finish();
rollback;
