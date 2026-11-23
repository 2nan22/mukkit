-- QA 56 보안 — 링크 리스트는 직접 못 읽음 · 차단 사이 리스트 · 팔로우 안 보임 · 남끼리 차단 못 엿봄 · 프로필 숨김 칸 · 약속 참여 차단
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'qs-a@test.local'),
  ('d2222222-2222-2222-2222-222222222222', 'qs-b@test.local'),
  ('d3333333-3333-3333-3333-333333333333', 'qs-c@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
  values ('a9400000-0000-0000-0000-000000000001', 'kakao', 'qs-test-1', '보안검사식당', 37.5, 127.0, 'korean');
insert into public.lists (id, owner_id, name, visibility) values
  ('a9400000-0000-0000-0000-0000000000a1', 'd1111111-1111-1111-1111-111111111111', '링크리스트', 'link'),
  ('a9400000-0000-0000-0000-0000000000a2', 'd1111111-1111-1111-1111-111111111111', '공개리스트', 'public');
insert into public.list_items (list_id, place_id) values
  ('a9400000-0000-0000-0000-0000000000a1', 'a9400000-0000-0000-0000-000000000001'),
  ('a9400000-0000-0000-0000-0000000000a2', 'a9400000-0000-0000-0000-000000000001');
insert into public.follows (follower_id, followee_id) values ('d3333333-3333-3333-3333-333333333333', 'd1111111-1111-1111-1111-111111111111');
insert into public.meetups (id, host_id, purpose, invite_token) values ('a9400000-0000-0000-0000-0000000000b1', 'd3333333-3333-3333-3333-333333333333', 'meal', 'a94000000000000000000b01');
insert into public.meetup_members (meetup_id, user_id) values ('a9400000-0000-0000-0000-0000000000b1', 'd1111111-1111-1111-1111-111111111111');
insert into public.blocks (blocker_id, blocked_id) values ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from public.lists where id = 'a9400000-0000-0000-0000-0000000000a1'), 0, '비로그인은 링크 리스트를 직접 못 읽음');
select is((select count(*)::int from public.list_items where list_id = 'a9400000-0000-0000-0000-0000000000a1'), 0, '비로그인은 링크 리스트 항목도 못 읽음');
select is((select count(*)::int from public.public_list('a9400000-0000-0000-0000-0000000000a1')), 1, '링크를 아는 사람은 public_list 로 봄');
select is((select count(*)::int from public.lists where id = 'a9400000-0000-0000-0000-0000000000a2'), 1, '공개 리스트는 직접 읽힘');
select is(public.is_blocked('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222'), false, '비로그인은 남끼리 차단을 못 엿봄');
select throws_ok($$select terms_version from public.profiles limit 1$$, '42501', null, '프로필 가입 단계 칸은 공개 아님');
select is((select count(*)::int from public.profiles where id = 'd1111111-1111-1111-1111-111111111111' and nickname is not null), 1, '닉네임은 공개');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(public.is_blocked('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222'), false, '남끼리 차단은 로그인해도 못 엿봄');
select is((select count(*)::int from public.my_profile_flags()), 1, '내 가입 단계는 함수로 봄');

select set_config('request.jwt.claims', '{"sub":"d2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.lists where owner_id = 'd1111111-1111-1111-1111-111111111111'), 0, '차단당한 쪽은 공개 리스트도 직접 못 읽음');
select is((select count(*)::int from public.follows where followee_id = 'd1111111-1111-1111-1111-111111111111'), 0, '차단당한 쪽은 그 사람의 팔로우도 못 봄');
select is((select count(*)::int from public.profile_lists('d1111111-1111-1111-1111-111111111111')), 0, '프로필 리스트에도 안 나옴');
select throws_ok($$select public.join_meetup('a94000000000000000000b01')$$, '42501', null, '참여자 중 차단한 사람이 있으면 약속 참여 못 함');

select * from finish();
rollback;
