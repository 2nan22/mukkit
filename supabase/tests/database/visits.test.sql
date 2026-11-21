-- 함께 방문한 기록 — 수락 전엔 남에게 안 보임, 남의 줄을 대신 못 바꿈, 공개 범위 · 피드 허용 준수
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('91111111-1111-1111-1111-111111111111', 'vs-a@test.local'),
  ('92222222-2222-2222-2222-222222222222', 'vs-b@test.local'),
  ('93333333-3333-3333-3333-333333333333', 'vs-c@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
  values ('a9000000-0000-0000-0000-000000000001', 'kakao', 'vs-test-1', '방문검사식당', 37.5, 127.0, 'korean');

-- A: 저장 · 평가(공개) 후 방문을 만들고 B 를 태그, 이름 메모 하나
insert into public.user_places (user_id, place_id, tier, visibility)
  values ('91111111-1111-1111-1111-111111111111', 'a9000000-0000-0000-0000-000000000001', 'three', 'public');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"92222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.visits (place_id, created_by) values ('a9000000-0000-0000-0000-000000000001', '92222222-2222-2222-2222-222222222222')$$,
  '42501', null, '저장하지 않은 장소엔 방문을 못 만듦');

select set_config('request.jwt.claims', '{"sub":"91111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.visits (id, place_id, created_by, visited_on)
  values ('b9000000-0000-0000-0000-000000000001', 'a9000000-0000-0000-0000-000000000001', '91111111-1111-1111-1111-111111111111', '2026-11-20');
insert into public.visit_members (visit_id, user_id) values ('b9000000-0000-0000-0000-000000000001', '92222222-2222-2222-2222-222222222222');
insert into public.visit_members (visit_id, guest_name, status) values ('b9000000-0000-0000-0000-000000000001', '회사 동료', 'accepted');
select is((select jsonb_array_length(members) from public.my_visits('a9000000-0000-0000-0000-000000000001')), 2, '만든 사람은 태그 · 이름 메모를 다 봄');
select throws_ok(
  $$insert into public.visit_members (visit_id, user_id, status) values ('b9000000-0000-0000-0000-000000000001', '93333333-3333-3333-3333-333333333333', 'accepted')$$,
  '42501', null, '남을 수락 상태로 넣을 수 없음');
select is(public.visit_companions('91111111-1111-1111-1111-111111111111', 'a9000000-0000-0000-0000-000000000001'), '[]'::jsonb, '수락 전에는 함께 간 사람에 안 나옴');

-- C: 남이라 방문 · 태그를 못 봄
select set_config('request.jwt.claims', '{"sub":"93333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.visits), 0, '남의 방문은 안 보임');
select is((select count(*)::int from public.visit_members), 0, '남의 태그는 안 보임');
select throws_ok($$select public.respond_visit('b9000000-0000-0000-0000-000000000001', true)$$, 'P0002', null, '태그 안 된 사람은 수락 불가');

-- B: 태그를 보고, 다른 줄은 못 바꿈, 수락하면 장소가 저장됨
select set_config('request.jwt.claims', '{"sub":"92222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.received_visit_tags()), 1, '받은 태그 1건');
select is((select members->0->>'userId' from public.my_visits('a9000000-0000-0000-0000-000000000001') where jsonb_array_length(members) = 1), '91111111-1111-1111-1111-111111111111', '태그된 사람에게는 만든 사람만 · 이름 메모는 안 보임');
delete from public.visit_members where guest_name = '회사 동료';
reset role;
select is((select count(*)::int from public.visit_members where guest_name = '회사 동료'), 1, '남이 만든 이름 메모는 못 지움');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"92222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(public.respond_visit('b9000000-0000-0000-0000-000000000001', true, false), 'a9000000-0000-0000-0000-000000000001'::uuid, '수락');
select is((select tier::text from public.user_places where user_id = '92222222-2222-2222-2222-222222222222'), 'unrated', '수락하면 평가 전으로 저장');

-- B 평가가 '나만'이면 남(C)에게는 함께 간 사람으로 안 나옴
update public.user_places set tier = 'two', visibility = 'private' where user_id = '92222222-2222-2222-2222-222222222222';
select set_config('request.jwt.claims', '{"sub":"93333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(public.visit_companions('91111111-1111-1111-1111-111111111111', 'a9000000-0000-0000-0000-000000000001'), '[]'::jsonb, '비공개 평가인 사람은 숨김');

-- B 가 공개로 바꾸면 보이고, 피드는 B 가 허용하지 않아 안 보임
select set_config('request.jwt.claims', '{"sub":"92222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
update public.user_places set visibility = 'public' where user_id = '92222222-2222-2222-2222-222222222222';
select set_config('request.jwt.claims', '{"sub":"93333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(jsonb_array_length(public.visit_companions('91111111-1111-1111-1111-111111111111', 'a9000000-0000-0000-0000-000000000001')), 1, '공개면 함께 간 사람으로 보임 (이름 메모는 안 나옴)');
select is(public.visit_companions('91111111-1111-1111-1111-111111111111', 'a9000000-0000-0000-0000-000000000001', true), '[]'::jsonb, '피드에 보이기를 끈 사람은 피드에서 빠짐');

select set_config('request.jwt.claims', '{"sub":"92222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.set_visit_feed('b9000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"93333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is(jsonb_array_length(public.visit_companions('91111111-1111-1111-1111-111111111111', 'a9000000-0000-0000-0000-000000000001', true)), 1, '둘 다 허용하면 피드에 보임');

-- 탈퇴 등으로 사람이 지워지면 태그도 같이 지워짐
reset role;
delete from auth.users where id = '92222222-2222-2222-2222-222222222222';
select is((select count(*)::int from public.visit_members where visit_id = 'b9000000-0000-0000-0000-000000000001' and user_id is not null), 1, '지워진 사람의 태그는 정리됨');

select * from finish();
rollback;
