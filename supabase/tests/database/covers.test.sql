-- 대표 사진 — 내 사진 먼저 · 팔로잉 다음 · 남의 비공개 평가 사진은 안 고름
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('b1111111-1111-1111-1111-111111111111', 'cv-a@test.local'),
  ('b2222222-2222-2222-2222-222222222222', 'cv-b@test.local'),
  ('b3333333-3333-3333-3333-333333333333', 'cv-c@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
  values ('a9200000-0000-0000-0000-000000000001', 'kakao', 'cv-test-1', '사진검사식당', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, visibility) values
  ('b1111111-1111-1111-1111-111111111111', 'a9200000-0000-0000-0000-000000000001', 'two', 'private'),
  ('b2222222-2222-2222-2222-222222222222', 'a9200000-0000-0000-0000-000000000001', 'three', 'public'),
  ('b3333333-3333-3333-3333-333333333333', 'a9200000-0000-0000-0000-000000000001', 'one', 'public');
insert into public.rating_media (user_id, place_id, path, kind, created_at) values
  ('b1111111-1111-1111-1111-111111111111', 'a9200000-0000-0000-0000-000000000001', 'cv-a/1.jpg', 'image', now() - interval '3 days'),
  ('b2222222-2222-2222-2222-222222222222', 'a9200000-0000-0000-0000-000000000001', 'cv-b/1.jpg', 'image', now() - interval '2 days'),
  ('b3333333-3333-3333-3333-333333333333', 'a9200000-0000-0000-0000-000000000001', 'cv-c/1.jpg', 'image', now() - interval '1 day');
insert into public.follows (follower_id, followee_id) values ('b3333333-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select path from public.place_covers(array['a9200000-0000-0000-0000-000000000001'::uuid])), 'cv-a/1.jpg', '내 사진이 먼저 (나만 공개여도)');

select set_config('request.jwt.claims', '{"sub":"b3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select path from public.place_covers(array['a9200000-0000-0000-0000-000000000001'::uuid])), 'cv-c/1.jpg', '내 사진이 있으면 팔로잉보다 내 사진');
delete from public.rating_media where user_id = 'b3333333-3333-3333-3333-333333333333';
select is((select path from public.place_covers(array['a9200000-0000-0000-0000-000000000001'::uuid])), 'cv-b/1.jpg', '팔로우하는 사람 사진 · 남의 나만 공개 사진(A)은 안 고름');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select path from public.place_covers(array['a9200000-0000-0000-0000-000000000001'::uuid])), 'cv-b/1.jpg', '로그인 안 해도 공개 평가 사진만');

-- 협찬 표시 평가의 사진은 남에게 대표로 쓰지 않음
reset role;
update public.user_places set sponsored = true where user_id = 'b2222222-2222-2222-2222-222222222222';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.place_covers(array['a9200000-0000-0000-0000-000000000001'::uuid])), 0, '협찬 평가 사진은 대표에서 빠짐');

select * from finish();
rollback;
