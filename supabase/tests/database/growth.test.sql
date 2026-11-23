-- 키우는 캐릭터 점수 — 지금 기록에서 다시 계산: 협찬 · 숨김 제외, 지우면 빠짐, 남은 못 봄
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('e9111111-1111-1111-1111-111111111111', 'gr-a@test.local'),
  ('e9222222-2222-2222-2222-222222222222', 'gr-b@test.local'),
  ('e9333333-3333-3333-3333-333333333333', 'gr-c@test.local'),
  ('e9444444-4444-4444-4444-444444444444', 'gr-d@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine, address) values
  ('a9900000-0000-0000-0000-000000000001', 'kakao', 'gr-1', '성장국밥', 37.5, 127.0, 'korean', '서울 성동구 가짜로 1'),
  ('a9900000-0000-0000-0000-000000000002', 'kakao', 'gr-2', '성장칼국수', 37.5, 127.0, 'korean', '서울 마포구 가짜로 2'),
  ('a9900000-0000-0000-0000-000000000003', 'kakao', 'gr-3', '성장협찬', 37.5, 127.0, 'korean', '서울 강남구 가짜로 3');
insert into public.user_places (user_id, place_id, tier, review, sponsored, visibility) values
  ('e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000001', 'three', '국물이 진하고 깔끔해요', false, 'public'),
  ('e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000002', 'two', '짧음', false, 'public'),
  ('e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000003', 'two', '협찬으로 다녀온 곳이에요 정말로', true, 'public');
insert into public.rating_likes (user_id, owner_id, place_id) values
  ('e9222222-2222-2222-2222-222222222222', 'e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000002'),
  ('e9222222-2222-2222-2222-222222222222', 'e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000003');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select ratings from public.my_growth()), 2, '협찬 표시 평가는 세지 않음');
select is((select reviews from public.my_growth()), 1, '한 줄 평가는 10자 넘는 것만');
select is((select areas from public.my_growth()), 2, '동네는 시 · 구 단위로 셈');
select is((select likes_points from public.my_growth()), 2, '협찬 평가에 받은 좋아요는 빼고 2점');

-- 서로 다른 세 사람이 신고하면 숨겨지고 점수에서도 빠짐
reset role;
insert into public.reports (reporter_id, target_user, target_place, reason) values
  ('e9222222-2222-2222-2222-222222222222', 'e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000002', 'ad'),
  ('e9333333-3333-3333-3333-333333333333', 'e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000002', 'ad'),
  ('e9444444-4444-4444-4444-444444444444', 'e9111111-1111-1111-1111-111111111111', 'a9900000-0000-0000-0000-000000000002', 'ad');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select ratings from public.my_growth()), 1, '신고 3건으로 숨겨진 평가는 빠짐');
delete from public.user_places where user_id = 'e9111111-1111-1111-1111-111111111111' and place_id = 'a9900000-0000-0000-0000-000000000001';
select is((select ratings from public.my_growth()), 0, '지운 평가는 바로 빠짐');

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select * from public.my_growth()$$, '42501', null, '비로그인은 부를 수 없음');

select * from finish();
rollback;
