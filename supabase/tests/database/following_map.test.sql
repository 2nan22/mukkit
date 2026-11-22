-- 팔로잉 지도 — 팔로우한 사람 평가만 · 공개 범위 · 협찬 · 평가 아닌 저장 제외 · 등급 높은 순
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'fm-a@test.local'),
  ('d2222222-2222-2222-2222-222222222222', 'fm-b@test.local'),
  ('d3333333-3333-3333-3333-333333333333', 'fm-c@test.local'),
  ('d4444444-4444-4444-4444-444444444444', 'fm-d@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('a9400000-0000-0000-0000-000000000001', 'kakao', 'fm-1', '팔로잉지도1', 37.5, 127.0, 'korean'),
  ('a9400000-0000-0000-0000-000000000002', 'kakao', 'fm-2', '팔로잉지도2', 37.5, 127.0, 'korean'),
  ('a9400000-0000-0000-0000-000000000003', 'kakao', 'fm-3', '팔로잉지도3', 37.5, 127.0, 'korean');
-- A 가 B · C 팔로우, D 는 팔로우 안 함
insert into public.follows (follower_id, followee_id) values
  ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222'),
  ('d1111111-1111-1111-1111-111111111111', 'd3333333-3333-3333-3333-333333333333');
insert into public.user_places (user_id, place_id, tier, visibility, sponsored) values
  ('d2222222-2222-2222-2222-222222222222', 'a9400000-0000-0000-0000-000000000001', 'two', 'public', false),
  ('d3333333-3333-3333-3333-333333333333', 'a9400000-0000-0000-0000-000000000001', 'three', 'followers', false),
  ('d2222222-2222-2222-2222-222222222222', 'a9400000-0000-0000-0000-000000000002', 'one', 'private', false),
  ('d3333333-3333-3333-3333-333333333333', 'a9400000-0000-0000-0000-000000000002', 'three', 'public', true),
  ('d2222222-2222-2222-2222-222222222222', 'a9400000-0000-0000-0000-000000000003', 'want_to_go', 'public', false),
  ('d4444444-4444-4444-4444-444444444444', 'a9400000-0000-0000-0000-000000000003', 'three', 'public', false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.following_map_places() where name like '팔로잉지도%'), 1, '보이는 장소는 1곳 (나만 · 협찬 · 가고 싶은 곳 · 팔로우 안 한 사람 제외)');
select is((select jsonb_array_length(raters) from public.following_map_places() where name = '팔로잉지도1'), 2, '두 사람 평가 모두');
select is((select raters->0->>'tier' from public.following_map_places() where name = '팔로잉지도1'), 'three', '높은 등급이 먼저');

-- 차단하면 빠짐
reset role;
insert into public.blocks (blocker_id, blocked_id) values ('d3333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select raters->0->>'tier' from public.following_map_places() where name = '팔로잉지도1'), 'two', '차단한 사이 평가는 빠짐');

reset role;
set local role anon;
select throws_ok($$select * from public.following_map_places()$$, '42501', null, '로그인 안 하면 못 부름');

select * from finish();
rollback;
