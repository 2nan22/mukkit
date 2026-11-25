-- 피드에 내 평가 (68-9) — 피드 탭(p_mine)만 내 전체 · 팔로워 공개 평가, 나만은 빠짐 · 기본값은 팔로잉 것만
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('fa111111-1111-1111-1111-111111111111', 'fm-me@test.local'),
  ('fa222222-2222-2222-2222-222222222222', 'fm-friend@test.local');
insert into public.follows (follower_id, followee_id) values ('fa111111-1111-1111-1111-111111111111', 'fa222222-2222-2222-2222-222222222222');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('fa900000-0000-0000-0000-000000000001', 'naver', 'fm-1', '내 공개', 37.5, 127.0, 'korean'),
  ('fa900000-0000-0000-0000-000000000002', 'naver', 'fm-2', '내 나만', 37.5, 127.0, 'korean'),
  ('fa900000-0000-0000-0000-000000000003', 'naver', 'fm-3', '친구 공개', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, visibility, updated_at) values
  ('fa111111-1111-1111-1111-111111111111', 'fa900000-0000-0000-0000-000000000001', 'two', 'followers', '2025-01-02'),
  ('fa111111-1111-1111-1111-111111111111', 'fa900000-0000-0000-0000-000000000002', 'two', 'private', '2025-01-03'),
  ('fa222222-2222-2222-2222-222222222222', 'fa900000-0000-0000-0000-000000000003', 'one', 'public', '2025-01-01');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select array_agg(place_name order by updated_at desc) from public.feed(null, 20, true) where place_id::text like 'fa9%'), array['내 공개', '친구 공개'], '피드 탭은 내 공개 평가와 팔로잉 평가를 날짜순으로');
select is((select count(*)::int from public.feed(null, 20, true) where place_name = '내 나만'), 0, '나만 평가는 피드에 안 나옴');
select is((select array_agg(place_name) from public.feed() where place_id::text like 'fa9%'), array['친구 공개'], '기본값(홈)은 팔로잉 것만');
reset role;

-- 남은 내 것만 섞이지 않음 — 친구 쪽에서 보면 내 평가는 팔로우하지 않았으니 안 나옴
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select array_agg(place_name) from public.feed(null, 20, true) where place_id::text like 'fa9%'), array['친구 공개'], '팔로우 안 한 사람 평가는 안 나옴');
reset role;

select * from finish();
rollback;
