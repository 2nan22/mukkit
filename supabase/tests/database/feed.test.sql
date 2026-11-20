-- 평가 공개 범위 · 팔로우 피드 · 프로필 평가 · 미디어 표
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('31111111-1111-1111-1111-111111111111', 'feed-a@test.local'),
  ('32222222-2222-2222-2222-222222222222', 'feed-b@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('c1111111-0000-0000-0000-000000000001', 'naver', 'feed-p1', '공개 가게', 37.5, 127.0, 'korean'),
  ('c1111111-0000-0000-0000-000000000002', 'naver', 'feed-p2', '팔로워 가게', 37.5, 127.0, 'korean'),
  ('c1111111-0000-0000-0000-000000000003', 'naver', 'feed-p3', '나만 가게', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, visibility, review, note) values
  ('31111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000001', 'three', 'public', '꼭 가세요', '비밀 메모'),
  ('31111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000002', 'two', 'followers', '친구만', '비밀 메모'),
  ('31111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000003', 'one', 'private', '', '비밀 메모');

-- B 로 접속, 아직 팔로우 전
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"32222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*)::int from public.feed()), 0, '팔로우 전에는 피드 없음');
select is((select array_agg(place_name order by place_name) from public.profile_ratings('31111111-1111-1111-1111-111111111111')),
  array['공개 가게'], '팔로우 전 프로필에는 공개 평가만');
select ok(not public.can_view_rating('31111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000003'), '나만 평가는 못 봄');

insert into public.follows (follower_id, followee_id) values
  ('32222222-2222-2222-2222-222222222222', '31111111-1111-1111-1111-111111111111');

select is((select array_agg(place_name order by place_name) from public.feed()),
  array['공개 가게', '팔로워 가게'], '팔로우하면 공개 · 팔로워 평가가 피드에');
select is((select array_agg(review order by review) from public.feed()),
  array['꼭 가세요', '친구만'], '피드에는 공개 한마디만 (메모 없음)');
select ok(not public.can_view_rating('31111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000003'), '팔로우해도 나만 평가는 못 봄');
select throws_ok(
  $$insert into public.rating_media (user_id, place_id, path, kind)
    values ('31111111-1111-1111-1111-111111111111', 'c1111111-0000-0000-0000-000000000001', 'x/y/z.jpg', 'image')$$,
  '42501', null, '남의 평가에 미디어를 붙일 수 없음');

-- 비로그인
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select array_agg(place_name) from public.profile_ratings('31111111-1111-1111-1111-111111111111')),
  array['공개 가게'], '비로그인은 공개 평가만');

select * from finish();
rollback;
