-- 취향 겹침 · 추천 · 프로필 통계
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('41111111-1111-1111-1111-111111111111', 'taste-a@test.local'),
  ('42222222-2222-2222-2222-222222222222', 'taste-b@test.local'),
  ('43333333-3333-3333-3333-333333333333', 'taste-c@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'taste-d@test.local'),
  ('45555555-5555-5555-5555-555555555555', 'taste-e@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('d1111111-0000-0000-0000-000000000001', 'naver', 'taste-p1', '가', 37.5, 127.0, 'korean'),
  ('d1111111-0000-0000-0000-000000000002', 'naver', 'taste-p2', '나', 37.5, 127.0, 'korean'),
  ('d1111111-0000-0000-0000-000000000003', 'naver', 'taste-p3', '다', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, visibility, sponsored) values
  ('41111111-1111-1111-1111-111111111111', 'd1111111-0000-0000-0000-000000000001', 'three', 'private', false),
  ('41111111-1111-1111-1111-111111111111', 'd1111111-0000-0000-0000-000000000002', 'two', 'private', false),
  ('41111111-1111-1111-1111-111111111111', 'd1111111-0000-0000-0000-000000000003', 'one', 'private', false),
  ('42222222-2222-2222-2222-222222222222', 'd1111111-0000-0000-0000-000000000001', 'three', 'public', false),
  ('42222222-2222-2222-2222-222222222222', 'd1111111-0000-0000-0000-000000000002', 'two', 'public', false),
  ('43333333-3333-3333-3333-333333333333', 'd1111111-0000-0000-0000-000000000001', 'not_recommended', 'public', false),
  ('43333333-3333-3333-3333-333333333333', 'd1111111-0000-0000-0000-000000000002', 'one', 'public', false),
  ('43333333-3333-3333-3333-333333333333', 'd1111111-0000-0000-0000-000000000003', 'three', 'public', false),
  ('44444444-4444-4444-4444-444444444444', 'd1111111-0000-0000-0000-000000000001', 'three', 'private', false),
  ('44444444-4444-4444-4444-444444444444', 'd1111111-0000-0000-0000-000000000002', 'two', 'private', false),
  ('45555555-5555-5555-5555-555555555555', 'd1111111-0000-0000-0000-000000000001', 'three', 'public', true),
  ('45555555-5555-5555-5555-555555555555', 'd1111111-0000-0000-0000-000000000002', 'two', 'public', true);

insert into public.lists (owner_id, name, visibility) values
  ('42222222-2222-2222-2222-222222222222', '공개 리스트', 'public'),
  ('42222222-2222-2222-2222-222222222222', '링크 리스트', 'link'),
  ('41111111-1111-1111-1111-111111111111', '내 공개 리스트', 'public');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"41111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

select results_eq(
  $$select overlap, both_three, similarity from public.taste_with('42222222-2222-2222-2222-222222222222')$$,
  $$values (2, 1, 1.000::numeric)$$, '같은 등급 두 곳 — 겹침 2 · 둘 다 3스타 1 · 비슷함 1');
select results_eq(
  $$select overlap, similarity from public.taste_with('43333333-3333-3333-3333-333333333333')$$,
  $$values (3, 0.333::numeric)$$, '반대 취향 — 비슷함 낮음');
select is((select overlap from public.taste_with('44444444-4444-4444-4444-444444444444')), 0, '나만 공개 평가는 겹침에 안 들어감');
select is((select overlap from public.taste_with('45555555-5555-5555-5555-555555555555')), 0, '협찬 평가는 겹침에서 뺌');
select is((select array_agg(nickname order by similarity desc) from public.taste_matches() where user_id::text like '4%'),
  array[(select nickname from public.profiles where id = '42222222-2222-2222-2222-222222222222'),
        (select nickname from public.profiles where id = '43333333-3333-3333-3333-333333333333')],
  '추천은 비슷한 사람부터, 볼 수 없는 · 협찬 평가만 있는 사람은 빠짐');

select is((select three_ratio from public.taste_matches() where user_id = '42222222-2222-2222-2222-222222222222'), 50, '추천 사람의 3스타 비율 (볼 수 있는 평가 기준)');
select is((select array_agg(name) from public.recent_public_lists(20) where owner_nickname in (select nickname from public.profiles where id::text like '4%')),
  array['공개 리스트'], '새로 공개된 리스트는 남의 공개 리스트만 (링크 · 내 것 제외)');
insert into public.follows (follower_id, followee_id) values ('41111111-1111-1111-1111-111111111111', '42222222-2222-2222-2222-222222222222');
select ok(not exists (select 1 from public.taste_matches() where user_id = '42222222-2222-2222-2222-222222222222'), '이미 팔로우한 사람은 추천에서 빠짐');
select results_eq(
  $$select three, two, sponsored from public.profile_stats('45555555-5555-5555-5555-555555555555')$$,
  $$values (0, 0, 2)$$, '협찬 평가는 등급 수에서 빼고 따로 셈');

select * from finish();
rollback;
