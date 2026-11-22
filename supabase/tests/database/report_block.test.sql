-- 신고 · 차단 — 서로 안 보이고, 팔로우 · 초대 · 태그를 못 하고, 신고 3명이면 숨김
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'rb-a@test.local'),
  ('c2222222-2222-2222-2222-222222222222', 'rb-b@test.local'),
  ('c3333333-3333-3333-3333-333333333333', 'rb-c@test.local'),
  ('c4444444-4444-4444-4444-444444444444', 'rb-d@test.local'),
  ('c5555555-5555-5555-5555-555555555555', 'rb-e@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
  values ('a9300000-0000-0000-0000-000000000001', 'kakao', 'rb-test-1', '신고검사식당', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, visibility) values
  ('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'three', 'public'),
  ('c2222222-2222-2222-2222-222222222222', 'a9300000-0000-0000-0000-000000000001', 'two', 'public');
insert into public.follows (follower_id, followee_id) values
  ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222'),
  ('c2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111');
insert into public.lists (id, owner_id, name, visibility) values ('a9300000-0000-0000-0000-0000000000a1', 'c1111111-1111-1111-1111-111111111111', '차단검사리스트', 'public');
insert into public.meetups (id, host_id, purpose) values ('a9300000-0000-0000-0000-0000000000b1', 'c1111111-1111-1111-1111-111111111111', 'meal');

-- A 가 B 를 차단
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.blocks (blocker_id, blocked_id) values ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222');
select is((select count(*)::int from public.place_ratings('a9300000-0000-0000-0000-000000000001')), 0, '차단한 사람(B)의 평가가 안 보임');
select throws_ok($$select public.invite_to_meetup('a9300000-0000-0000-0000-0000000000b1', 'c2222222-2222-2222-2222-222222222222')$$, '42501', null, '차단한 사람은 약속에 초대 못 함');

select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.place_ratings('a9300000-0000-0000-0000-000000000001')), 0, '차단당한 쪽(B)도 A 의 평가가 안 보임');
select is((select count(*)::int from public.public_list('a9300000-0000-0000-0000-0000000000a1')), 0, '차단당한 쪽은 A 의 공개 리스트도 안 보임');
select is((select count(*)::int from public.my_block_ids() where my_block_ids = 'c1111111-1111-1111-1111-111111111111'), 1, '검색에서 뺄 사람에 A 포함');
select is((select count(*)::int from public.blocks), 0, '누가 나를 막았는지 차단 목록은 안 보임');
select throws_ok($$insert into public.follows (follower_id, followee_id) values ('c2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111')$$, '42501', null, '차단한 사이엔 팔로우 못 함');

reset role;
select is((select count(*)::int from public.follows where follower_id in ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222') and followee_id in ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222')), 0, '차단하면 서로의 팔로우가 풀림');

-- 신고: C · D 두 명이면 아직 보이고, E 까지 세 명이면 남에게 숨김 · 본인은 봄
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
insert into public.reports (reporter_id, target_user, target_place, reason) values ('c3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'ad');
select throws_ok($$insert into public.reports (reporter_id, target_user, target_place, reason) values ('c3333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'other')$$, '23505', null, '같은 평가를 두 번 신고 못 함');
select throws_ok($$insert into public.reports (reporter_id, target_user, reason) values ('c3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'other')$$, '23514', null, '나를 신고 못 함');
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
insert into public.reports (reporter_id, target_user, target_place, reason) values ('c4444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'inappropriate');
select is((select count(*)::int from public.place_ratings('a9300000-0000-0000-0000-000000000001') where user_id = 'c1111111-1111-1111-1111-111111111111'), 1, '신고 2명이면 아직 보임');
select set_config('request.jwt.claims', '{"sub":"c5555555-5555-5555-5555-555555555555","role":"authenticated"}', true);
insert into public.reports (reporter_id, target_user, target_place, reason) values ('c5555555-5555-5555-5555-555555555555', 'c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'fake');
select is((select count(*)::int from public.place_ratings('a9300000-0000-0000-0000-000000000001') where user_id = 'c1111111-1111-1111-1111-111111111111'), 0, '서로 다른 3명이 신고하면 남에게 숨김');
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.can_view_rating('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001'), true, '본인은 자기 평가를 계속 봄');

select * from finish();
rollback;
