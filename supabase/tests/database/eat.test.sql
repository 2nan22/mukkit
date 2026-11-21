-- 여기서 뭐 먹지 후보 · 장소 상세 남 평가
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('51111111-1111-1111-1111-111111111111', 'eat-a@test.local'),
  ('52222222-2222-2222-2222-222222222222', 'eat-b@test.local'),
  ('53333333-3333-3333-3333-333333333333', 'eat-c@test.local'),
  ('54444444-4444-4444-4444-444444444444', 'eat-d@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'eat-e@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine, available) values
  ('e1111111-0000-0000-0000-000000000001', 'naver', 'eat-1', '팔로잉3스타', 33.0001, 126.0001, 'korean', true),
  ('e1111111-0000-0000-0000-000000000002', 'naver', 'eat-2', '공개2스타', 33.0002, 126.0002, 'japanese', true),
  ('e1111111-0000-0000-0000-000000000003', 'naver', 'eat-3', '나만공개', 33.0003, 126.0003, 'korean', true),
  ('e1111111-0000-0000-0000-000000000004', 'naver', 'eat-4', '협찬', 33.0004, 126.0004, 'korean', true),
  ('e1111111-0000-0000-0000-000000000005', 'naver', 'eat-5', '내가고싶은곳', 33.0005, 126.0005, 'cafe', true),
  ('e1111111-0000-0000-0000-000000000006', 'naver', 'eat-6', '내가비추', 33.0006, 126.0006, 'korean', true),
  ('e1111111-0000-0000-0000-000000000007', 'naver', 'eat-7', '먼곳', 33.1, 126.1, 'korean', true),
  ('e1111111-0000-0000-0000-000000000008', 'naver', 'eat-8', '폐업', 33.0008, 126.0008, 'korean', false);
insert into public.user_places (user_id, place_id, tier, visibility, sponsored, note) values
  ('52222222-2222-2222-2222-222222222222', 'e1111111-0000-0000-0000-000000000001', 'three', 'followers', false, '비밀'),
  ('53333333-3333-3333-3333-333333333333', 'e1111111-0000-0000-0000-000000000002', 'two', 'public', false, ''),
  ('54444444-4444-4444-4444-444444444444', 'e1111111-0000-0000-0000-000000000003', 'three', 'private', false, ''),
  ('55555555-5555-5555-5555-555555555555', 'e1111111-0000-0000-0000-000000000004', 'three', 'public', true, ''),
  ('51111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000005', 'want_to_go', 'private', false, ''),
  ('51111111-1111-1111-1111-111111111111', 'e1111111-0000-0000-0000-000000000006', 'not_recommended', 'private', false, ''),
  ('52222222-2222-2222-2222-222222222222', 'e1111111-0000-0000-0000-000000000006', 'three', 'public', false, ''),
  ('52222222-2222-2222-2222-222222222222', 'e1111111-0000-0000-0000-000000000007', 'three', 'public', false, ''),
  ('52222222-2222-2222-2222-222222222222', 'e1111111-0000-0000-0000-000000000008', 'three', 'public', false, '');
insert into public.follows (follower_id, followee_id) values ('51111111-1111-1111-1111-111111111111', '52222222-2222-2222-2222-222222222222');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"51111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select is((select array_agg(name order by name) from public.eat_candidates(33.0, 126.0, 1000)),
  array['공개2스타', '내가고싶은곳', '팔로잉3스타'],
  '후보: 팔로잉 · 공개 2 · 3스타와 내 가고 싶은 곳 (나만 공개 · 협찬 · 내 비추 · 먼 곳 · 폐업 제외)');
select is((select raters -> 0 ->> 'followed' from public.eat_candidates(33.0, 126.0, 1000) where name = '팔로잉3스타'),
  'true', '평가한 사람이 팔로잉인지 함께');
select is((select my_tier::text from public.eat_candidates(33.0, 126.0, 1000) where name = '내가고싶은곳'),
  'want_to_go', '내 상태 함께');
select is((select array_agg(nickname) from public.place_ratings('e1111111-0000-0000-0000-000000000001')),
  array[(select nickname from public.profiles where id = '52222222-2222-2222-2222-222222222222')], '장소 상세: 팔로워 공개 평가가 보임');
select is((select count(*)::int from public.place_ratings('e1111111-0000-0000-0000-000000000003')), 0, '장소 상세: 나만 공개 평가는 안 보임');

select * from finish();
rollback;
