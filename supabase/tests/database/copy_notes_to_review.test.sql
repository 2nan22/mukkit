-- 가져온 메모를 한 줄 평가로 (68-2) — 가져온 메모 그대로 · 다녀온 등급 · 한 줄 평가가 빈 곳만, 메모 · updated_at 은 그대로, 남의 것은 못 바꿈
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('f1111111-1111-1111-1111-111111111111', 'cn-a@test.local'),
  ('f2222222-2222-2222-2222-222222222222', 'cn-b@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('f9000000-0000-0000-0000-000000000001', 'naver', 'cn-1', '가져온집', 37.5, 127.0, 'korean'),
  ('f9000000-0000-0000-0000-000000000002', 'naver', 'cn-2', '직접쓴집', 37.5, 127.0, 'korean'),
  ('f9000000-0000-0000-0000-000000000003', 'naver', 'cn-3', '가고싶은집', 37.5, 127.0, 'korean'),
  ('f9000000-0000-0000-0000-000000000004', 'naver', 'cn-4', '평가있는집', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, note, review, updated_at) values
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000001', 'two', '혼밥하기 좋음', '', '2025-01-01'),
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000002', 'two', '내가 쓴 비밀 메모', '', '2025-01-01'),
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000003', 'want_to_go', '가 볼 곳', '', '2025-01-01'),
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000004', 'three', '원본 메모', '이미 쓴 평가', '2025-01-01');
insert into public.imported_items (user_id, source, source_list_id, source_place_id, place_id, list_name, memo) values
  ('f1111111-1111-1111-1111-111111111111', 'naver', 'l', 'cn-1', 'f9000000-0000-0000-0000-000000000001', '리스트', '혼밥하기 좋음'),
  ('f1111111-1111-1111-1111-111111111111', 'naver', 'l', 'cn-3', 'f9000000-0000-0000-0000-000000000003', '리스트', '가 볼 곳'),
  ('f1111111-1111-1111-1111-111111111111', 'naver', 'l', 'cn-4', 'f9000000-0000-0000-0000-000000000004', '리스트', '원본 메모');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is(public.copy_notes_to_review('f1111111-1111-1111-1111-111111111111'), 0, '남의 것은 0줄');

select set_config('request.jwt.claims', '{"sub":"f1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.count_notes_to_review('f1111111-1111-1111-1111-111111111111'), 1, '옮길 곳 1');
select is(public.copy_notes_to_review('f1111111-1111-1111-1111-111111111111'), 1, '가져온 메모 그대로인 곳만 옮김');
reset role;
select is((select review from public.user_places where place_id = 'f9000000-0000-0000-0000-000000000001'), '혼밥하기 좋음', '한 줄 평가가 됨');
select is((select note || '|' || updated_at::date from public.user_places where place_id = 'f9000000-0000-0000-0000-000000000001'), '혼밥하기 좋음|2025-01-01', '메모 · updated_at 그대로');
select is((select review from public.user_places where place_id = 'f9000000-0000-0000-0000-000000000002'), '', '직접 쓴 메모는 공개하지 않음');
select is((select string_agg(review, ',' order by place_id) from public.user_places where place_id in ('f9000000-0000-0000-0000-000000000003', 'f9000000-0000-0000-0000-000000000004')), ',이미 쓴 평가', '가고 싶은 곳 · 이미 쓴 평가는 그대로');

select * from finish();
rollback;
