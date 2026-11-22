-- 3스타 순위 — 내 행만 · 3스타만 · 등급 바뀌면 지움
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('e1111111-1111-1111-1111-111111111111', 'tr-a@test.local'),
  ('e2222222-2222-2222-2222-222222222222', 'tr-b@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('a9500000-0000-0000-0000-000000000001', 'kakao', 'tr-1', '순위1', 37.5, 127.0, 'korean'),
  ('a9500000-0000-0000-0000-000000000002', 'kakao', 'tr-2', '순위2', 37.5, 127.0, 'korean'),
  ('a9500000-0000-0000-0000-000000000003', 'kakao', 'tr-3', '순위3', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier) values
  ('e1111111-1111-1111-1111-111111111111', 'a9500000-0000-0000-0000-000000000001', 'three'),
  ('e1111111-1111-1111-1111-111111111111', 'a9500000-0000-0000-0000-000000000002', 'three'),
  ('e1111111-1111-1111-1111-111111111111', 'a9500000-0000-0000-0000-000000000003', 'two'),
  ('e2222222-2222-2222-2222-222222222222', 'a9500000-0000-0000-0000-000000000001', 'three');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.set_three_order(array['a9500000-0000-0000-0000-000000000002', 'a9500000-0000-0000-0000-000000000001', 'a9500000-0000-0000-0000-000000000003']::uuid[]);
reset role;
select is((select string_agg(place_id::text || ':' || coalesce(tier_rank::text, '-'), ',' order by place_id) from public.user_places where user_id = 'e1111111-1111-1111-1111-111111111111'),
  'a9500000-0000-0000-0000-000000000001:1,a9500000-0000-0000-0000-000000000002:0,a9500000-0000-0000-0000-000000000003:-', '배열 순서대로 · 2스타는 안 바뀜');
select is((select tier_rank from public.user_places where user_id = 'e2222222-2222-2222-2222-222222222222'), null, '남의 행은 안 바뀜');

update public.user_places set tier = 'two' where user_id = 'e1111111-1111-1111-1111-111111111111' and place_id = 'a9500000-0000-0000-0000-000000000002';
select is((select tier_rank from public.user_places where user_id = 'e1111111-1111-1111-1111-111111111111' and place_id = 'a9500000-0000-0000-0000-000000000002'), null, '등급 바뀌면 순위 지움');
update public.user_places set note = '메모' where user_id = 'e1111111-1111-1111-1111-111111111111' and place_id = 'a9500000-0000-0000-0000-000000000001';
select is((select tier_rank from public.user_places where user_id = 'e1111111-1111-1111-1111-111111111111' and place_id = 'a9500000-0000-0000-0000-000000000001'), 1, '등급 그대로면 순위 유지');

select * from finish();
rollback;
