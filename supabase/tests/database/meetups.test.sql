-- 여러 명 약속 — 참여자만, 서로의 위치는 못 읽음, 링크 · 앱 안 초대, 정원, 1km 깎기
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('71111111-1111-1111-1111-111111111111', 'mt-host@test.local'),
  ('72222222-2222-2222-2222-222222222222', 'mt-b@test.local'),
  ('73333333-3333-3333-3333-333333333333', 'mt-c@test.local'),
  ('74444444-4444-4444-4444-444444444444', 'mt-d@test.local');

-- 만든 사람
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.meetups (id, host_id, purpose, max_members) values ('d1111111-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'drinks', 3);
select is((select jsonb_array_length(members) from public.meetup_status('d1111111-0000-0000-0000-000000000001')), 1, '만든 사람이 첫 참여자');
insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng)
  values ('d1111111-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'return', '망원동', 37.556789, 126.901234);
select is((select lat from public.meetup_points where user_id = '71111111-1111-1111-1111-111111111111'), 37.56::double precision, '좌표는 약 1km 단위로 깎임');
select is((select count(*)::int from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001')), 0, '위치 넣은 사람이 한 명이면 점수 없음');

reset role;
select invite_token as tok from public.meetups where id = 'd1111111-0000-0000-0000-000000000001' \gset

-- B: 링크로 참여
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"72222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select host_nickname is not null and member_count = 1 from public.meetup_invite(:'tok')), true, '참여 전에도 초대 미리보기');
select is((select count(*)::int from public.meetups), 0, '참여 전에는 약속 행을 못 봄');
select is(public.join_meetup(:'tok'), 'd1111111-0000-0000-0000-000000000001'::uuid, '링크로 참여');
insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng)
  values ('d1111111-0000-0000-0000-000000000001', '72222222-2222-2222-2222-222222222222', 'origin', '잠실', 37.5133, 127.1001);
select is((select count(*)::int from public.meetup_points), 1, '다른 참여자 위치는 못 읽음 — 내 것 1줄만');
select is((select count(*)::int from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001', 3)), 3, '두 명이 넣으면 지역 3곳');
select is((select jsonb_array_length(people) from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001') limit 1), 2, '지역마다 사람별 시간');
select throws_ok(
  $$insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng) values ('d1111111-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'origin', '가짜', 37.5, 127.0)$$,
  '42501', null, '남의 위치를 대신 못 넣음');
select throws_ok(
  $$insert into public.meetup_members (meetup_id, user_id) values ('d1111111-0000-0000-0000-000000000001', '74444444-4444-4444-4444-444444444444')$$,
  '42501', null, '참여자 목록은 직접 못 넣음');
select throws_ok($$select public.invite_to_meetup('d1111111-0000-0000-0000-000000000001', '74444444-4444-4444-4444-444444444444')$$, '42501', null, '만든 사람이 아니면 초대 불가');

-- C: 링크로 참여 → 정원(3) 참
select set_config('request.jwt.claims', '{"sub":"73333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select lives_ok($$select public.join_meetup('$$ || :'tok' || $$')$$, '세 번째 참여');
select is((select jsonb_array_length(members) from public.meetup_status('d1111111-0000-0000-0000-000000000001')), 3, '참여자 3명');

-- D: 정원이 차 링크 참여 불가, 참여자가 아니면 점수 불가
select set_config('request.jwt.claims', '{"sub":"74444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select throws_ok($$select public.join_meetup('$$ || :'tok' || $$')$$, 'P0001', null, '정원이 차면 참여 불가');
select throws_ok($$select * from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001')$$, '42501', null, '참여자가 아니면 지역 점수 불가');

-- 만든 사람이 정원을 늘리고 D 를 초대 → D 는 보고 수락
reset role;
update public.meetups set max_members = 8 where id = 'd1111111-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.invite_to_meetup('d1111111-0000-0000-0000-000000000001', '74444444-4444-4444-4444-444444444444');
select set_config('request.jwt.claims', '{"sub":"74444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select is_invitee and not is_member from public.meetup_status('d1111111-0000-0000-0000-000000000001')), true, '초대받은 사람은 약속을 봄');
select public.respond_meetup_invite('d1111111-0000-0000-0000-000000000001', true);
select is((select is_member from public.meetup_status('d1111111-0000-0000-0000-000000000001')), true, '수락하면 참여자');

-- 정리 작업: 끝난 약속의 위치 삭제
reset role;
update public.meetups set status = 'done' where id = 'd1111111-0000-0000-0000-000000000001';
select is(public.cleanup_meetup_points(), 2, '끝난 약속의 위치 기록 정리');

select * from finish();
rollback;
