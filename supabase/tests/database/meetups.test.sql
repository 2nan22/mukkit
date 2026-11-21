-- 약속 잡기 — 당사자만, 상대 위치는 상대도 못 읽음, 링크 참여, 1km 깎기
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('71111111-1111-1111-1111-111111111111', 'mt-host@test.local'),
  ('72222222-2222-2222-2222-222222222222', 'mt-guest@test.local'),
  ('73333333-3333-3333-3333-333333333333', 'mt-other@test.local');

-- 만든 사람
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.meetups (id, host_id, purpose) values ('d1111111-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'drinks');
insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng)
  values ('d1111111-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'return', '망원동', 37.556789, 126.901234);
select is((select lat from public.meetup_points where user_id = '71111111-1111-1111-1111-111111111111'), 37.56::double precision, '좌표는 약 1km 단위로 깎임');
select is((select count(*)::int from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001')), 0, '상대가 없으면 지역 점수 없음');

reset role;
select invite_token as tok from public.meetups where id = 'd1111111-0000-0000-0000-000000000001' \gset

-- 링크를 받은 사람이 참여
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"72222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select host_nickname is not null from public.meetup_invite(:'tok')), true, '참여 전에도 초대 미리보기');
select is((select count(*)::int from public.meetups), 0, '참여 전에는 약속 행을 못 봄');
select is(public.join_meetup(:'tok'), 'd1111111-0000-0000-0000-000000000001'::uuid, '링크로 참여');
insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng)
  values ('d1111111-0000-0000-0000-000000000001', '72222222-2222-2222-2222-222222222222', 'origin', '잠실', 37.5133, 127.1001);
select is((select count(*)::int from public.meetup_points), 1, '상대(만든 사람) 위치는 못 읽음 — 내 것 1줄만');
select is((select count(*)::int from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001', 3)), 3, '둘 다 넣으면 지역 3곳');
select is((select partner_ready from public.meetup_status('d1111111-0000-0000-0000-000000000001')), true, '상대가 넣었는지만 앎');
select is((select invite_token from public.meetup_status('d1111111-0000-0000-0000-000000000001')), null, '초대 토큰은 만든 사람에게만');
select ok((select bool_and(my_minutes > 0 and partner_minutes > 0) from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001')), '지역마다 둘의 어림 시간');
select throws_ok(
  $$insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng) values ('d1111111-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'origin', '가짜', 37.5, 127.0)$$,
  '42501', null, '남의 위치를 대신 못 넣음');

-- 제3자
select set_config('request.jwt.claims', '{"sub":"73333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok($$select public.join_meetup('$$ || :'tok' || $$')$$, 'P0001', null, '자리가 차면 참여 불가');
select throws_ok($$select * from public.meetup_area_scores('d1111111-0000-0000-0000-000000000001')$$, '42501', null, '당사자가 아니면 지역 점수 불가');

-- 정리 작업: 끝난 약속의 위치 삭제
reset role;
update public.meetups set status = 'done' where id = 'd1111111-0000-0000-0000-000000000001';
select is(public.cleanup_meetup_points(), 2, '끝난 약속의 위치 기록 정리');

select * from finish();
rollback;
