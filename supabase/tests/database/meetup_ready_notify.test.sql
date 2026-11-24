-- 추천 지역 알림함 줄 (66) — 위치 넣은 사람이 둘 이상일 때 · 위치 넣은 다른 사람에게 · 약속 하나에 한 줄(최신으로 바뀜)
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('e7111111-1111-1111-1111-111111111111', 'mr-a@test.local'),
  ('e7222222-2222-2222-2222-222222222222', 'mr-b@test.local'),
  ('e7333333-3333-3333-3333-333333333333', 'mr-c@test.local');
insert into public.meetups (id, host_id, purpose) values ('e7900000-0000-0000-0000-000000000001', 'e7111111-1111-1111-1111-111111111111', 'meal');
insert into public.meetup_members (meetup_id, user_id) values
  ('e7900000-0000-0000-0000-000000000001', 'e7222222-2222-2222-2222-222222222222'),
  ('e7900000-0000-0000-0000-000000000001', 'e7333333-3333-3333-3333-333333333333');

insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng) values ('e7900000-0000-0000-0000-000000000001', 'e7111111-1111-1111-1111-111111111111', 'origin', '망원', 37.55, 126.9);
select is((select count(*)::int from public.notifications where kind = 'meetup_ready'), 0, '위치 넣은 사람이 하나면 없음');

insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng) values ('e7900000-0000-0000-0000-000000000001', 'e7222222-2222-2222-2222-222222222222', 'return', '잠실', 37.51, 127.1);
select is((select count(*)::int from public.notifications where kind = 'meetup_ready'), 1, '둘이 되면 앞서 넣은 사람에게 한 줄');
select is((select row(actor_id, point_kind, first_ready)::text from public.notifications where kind = 'meetup_ready' and user_id = 'e7111111-1111-1111-1111-111111111111'),
  row('e7222222-2222-2222-2222-222222222222'::uuid, 'return'::text, true)::text, '넣은 사람 · 귀가지 · 처음 나옴');

-- 같은 사람이 두 번째 종류를 넣어도 울리지 않음
update public.notifications set read_at = now() where kind = 'meetup_ready';
insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng) values ('e7900000-0000-0000-0000-000000000001', 'e7222222-2222-2222-2222-222222222222', 'origin', '강남', 37.5, 127.03);
select is((select count(*)::int from public.notifications where kind = 'meetup_ready' and read_at is null), 0, '같은 사람의 두 번째 위치는 알리지 않음');

insert into public.meetup_points (meetup_id, user_id, kind, label, lat, lng) values ('e7900000-0000-0000-0000-000000000001', 'e7333333-3333-3333-3333-333333333333', 'origin', '홍대', 37.55, 126.92);
select is((select count(*)::int from public.notifications where kind = 'meetup_ready'), 2, '세 번째 사람 — 앞선 두 사람에게, 약속 하나에 한 줄씩');
select is((select row(actor_id, first_ready, read_at is null)::text from public.notifications where kind = 'meetup_ready' and user_id = 'e7111111-1111-1111-1111-111111111111'),
  row('e7333333-3333-3333-3333-333333333333'::uuid, false, true)::text, '최신 내용으로 바뀌고 다시 안 읽음');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e7111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select first_ready from public.my_notifications() where kind = 'meetup_ready'), false, '알림함에 보임');

select * from finish();
rollback;
