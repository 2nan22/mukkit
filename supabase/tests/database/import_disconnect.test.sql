-- 가져온 원본 끊기 · 지우기 — 다른 리스트 · 다른 원본에 있는 곳과 남의 것은 남긴다
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('71111111-1111-1111-1111-111111111111', 'dc-a@test.local'),
  ('72222222-2222-2222-2222-222222222222', 'dc-b@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('f7000000-0000-0000-0000-000000000001', 'naver', 'dc-1', '이원본만', 33.2, 126.2, 'korean'),
  ('f7000000-0000-0000-0000-000000000002', 'naver', 'dc-2', '내리스트에도', 33.2, 126.2, 'korean'),
  ('f7000000-0000-0000-0000-000000000003', 'naver', 'dc-3', '다른원본에도', 33.2, 126.2, 'korean');
insert into public.user_places (user_id, place_id, tier, note) values
  ('71111111-1111-1111-1111-111111111111', 'f7000000-0000-0000-0000-000000000001', 'three', '메모'),
  ('71111111-1111-1111-1111-111111111111', 'f7000000-0000-0000-0000-000000000002', 'unrated', ''),
  ('71111111-1111-1111-1111-111111111111', 'f7000000-0000-0000-0000-000000000003', 'unrated', ''),
  ('72222222-2222-2222-2222-222222222222', 'f7000000-0000-0000-0000-000000000001', 'two', '');
insert into public.rating_media (user_id, place_id, path, kind) values
  ('71111111-1111-1111-1111-111111111111', 'f7000000-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111/f7000000-0000-0000-0000-000000000001/a.jpg', 'image');
insert into public.lists (id, owner_id, name, source, source_list_id) values
  ('f7100000-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', '가져온 리스트', 'naver', 'L1'),
  ('f7100000-0000-0000-0000-000000000002', '71111111-1111-1111-1111-111111111111', '내가 만든', null, null);
insert into public.list_items (list_id, place_id) values
  ('f7100000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001'),
  ('f7100000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000002'),
  ('f7100000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000002');
insert into public.imported_items (user_id, source, source_list_id, source_place_id, place_id) values
  ('71111111-1111-1111-1111-111111111111', 'naver', 'L1', 'dc-1', 'f7000000-0000-0000-0000-000000000001'),
  ('71111111-1111-1111-1111-111111111111', 'naver', 'L1', 'dc-2', 'f7000000-0000-0000-0000-000000000002'),
  ('71111111-1111-1111-1111-111111111111', 'naver', 'L1', 'dc-3', 'f7000000-0000-0000-0000-000000000003'),
  ('71111111-1111-1111-1111-111111111111', 'kakao', 'K1', 'dc-3', 'f7000000-0000-0000-0000-000000000003'),
  ('72222222-2222-2222-2222-222222222222', 'naver', 'L1', 'dc-1', 'f7000000-0000-0000-0000-000000000001');
insert into public.import_sources (user_id, source, source_list_id, mode) values
  ('71111111-1111-1111-1111-111111111111', 'naver', 'L1', 'plain'),
  ('72222222-2222-2222-2222-222222222222', 'naver', 'L1', 'plain');

set local role anon;
select throws_ok($$select * from public.disconnect_import_source('naver', 'L1', false)$$, '42501', null, '비로그인은 호출 불가');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select results_eq(
  $$select * from public.import_source_delete_targets('naver', 'L1')$$,
  $$values ('f7000000-0000-0000-0000-000000000001'::uuid)$$,
  '지울 곳은 이 원본에서만 온 곳 하나');

-- 연결만 끊기 (저장점으로 되돌려 지우기도 시험)
savepoint keep;
select is((select count(*)::int from public.disconnect_import_source('naver', 'L1', false)), 0, '연결만 끊으면 지울 파일 없음');
select is((select count(*)::int from public.user_places where user_id = '71111111-1111-1111-1111-111111111111'), 3, '연결만 끊으면 장소 그대로');
select is((select source from public.lists where id = 'f7100000-0000-0000-0000-000000000001'), null, '먹킷 리스트는 보통 리스트로');
select is((select count(*)::int from public.imported_items where user_id = '71111111-1111-1111-1111-111111111111' and source_list_id = 'L1')
        + (select count(*)::int from public.import_sources where user_id = '71111111-1111-1111-1111-111111111111' and source_list_id = 'L1'), 0, '원본 기록 · 새로 고침 지움');
rollback to savepoint keep;

select results_eq(
  $$select * from public.disconnect_import_source('naver', 'L1', true)$$,
  $$values ('71111111-1111-1111-1111-111111111111/f7000000-0000-0000-0000-000000000001/a.jpg'::text)$$,
  '지운 평가의 사진 경로를 돌려줌');
select is((select array_agg(place_id order by place_id) from public.user_places where user_id = '71111111-1111-1111-1111-111111111111'),
  array['f7000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000003']::uuid[], '다른 리스트 · 다른 원본에 있는 곳은 남김');
select is((select count(*)::int from public.lists where id = 'f7100000-0000-0000-0000-000000000001'), 0, '이 원본으로 만든 리스트 지움');
select is((select count(*)::int from public.imported_items where user_id = '71111111-1111-1111-1111-111111111111' and source = 'kakao'), 1, '다른 원본 기록은 그대로');

reset role;
select is((select count(*)::int from public.user_places where user_id = '72222222-2222-2222-2222-222222222222')
        + (select count(*)::int from public.imported_items where user_id = '72222222-2222-2222-2222-222222222222')
        + (select count(*)::int from public.import_sources where user_id = '72222222-2222-2222-2222-222222222222'), 3, '남의 평가 · 원본은 그대로');

select * from finish();
rollback;
