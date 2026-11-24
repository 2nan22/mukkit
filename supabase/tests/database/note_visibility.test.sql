-- 메모 공개 범위 (68-5) — 기본 평가와 같게 · 나만 · 팔로워 · 전체, 평가보다 넓어지지 않음
-- 가져온 메모 한 번에 바꾸기는 지도 앱 메모 그대로 · 다녀온 등급만, updated_at 그대로, 남의 것은 못 바꿈
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('f1111111-1111-1111-1111-111111111111', 'nv-owner@test.local'),
  ('f2222222-2222-2222-2222-222222222222', 'nv-follower@test.local'),
  ('f3333333-3333-3333-3333-333333333333', 'nv-stranger@test.local');
insert into public.follows (follower_id, followee_id) values ('f2222222-2222-2222-2222-222222222222', 'f1111111-1111-1111-1111-111111111111');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values
  ('f9000000-0000-0000-0000-000000000001', 'naver', 'nv-1', '같게', 37.5, 127.0, 'korean'),
  ('f9000000-0000-0000-0000-000000000002', 'naver', 'nv-2', '팔로워만', 37.5, 127.0, 'korean'),
  ('f9000000-0000-0000-0000-000000000003', 'naver', 'nv-3', '나만', 37.5, 127.0, 'korean'),
  ('f9000000-0000-0000-0000-000000000004', 'naver', 'nv-4', '직접쓴', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, note, visibility, note_visibility, updated_at) values
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000001', 'two', '같게 메모', 'public', null, '2025-01-01'),
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000002', 'two', '팔로워 메모', 'public', 'followers', '2025-01-01'),
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000003', 'two', '가져온 메모', 'public', 'private', '2025-01-01'),
  ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000004', 'two', '내가 쓴 비밀', 'public', 'private', '2025-01-01');
insert into public.imported_items (user_id, source, source_list_id, source_place_id, place_id, list_name, memo) values
  ('f1111111-1111-1111-1111-111111111111', 'naver', 'l', 'nv-3', 'f9000000-0000-0000-0000-000000000003', '리스트', '가져온 메모');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select note from public.place_ratings('f9000000-0000-0000-0000-000000000001') limit 1), '같게 메모', '평가와 같게 — 전체 공개 평가면 누구나');
select is((select note from public.place_ratings('f9000000-0000-0000-0000-000000000002') limit 1), '', '팔로워 메모는 모르는 사람에게 빈 값');
select is(public.set_imported_note_visibility('f1111111-1111-1111-1111-111111111111', null), 0, '남의 것은 0줄');

select set_config('request.jwt.claims', '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select note from public.place_ratings('f9000000-0000-0000-0000-000000000002') limit 1), '팔로워 메모', '팔로워에게는 보임');
select is((select note from public.place_ratings('f9000000-0000-0000-0000-000000000003') limit 1), '', '나만 메모는 팔로워에게도 빈 값');

select set_config('request.jwt.claims', '{"sub":"f1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(public.count_private_imported_notes('f1111111-1111-1111-1111-111111111111'), 1, '나만인 가져온 메모 1곳 (직접 쓴 메모 제외)');
select is(public.set_imported_note_visibility('f1111111-1111-1111-1111-111111111111', null), 1, '가져온 메모만 평가와 같게');
reset role;
select is((select note_visibility::text || '|' || updated_at::date from public.user_places where place_id = 'f9000000-0000-0000-0000-000000000004'), 'private|2025-01-01', '직접 쓴 메모는 그대로');
select is((select coalesce(note_visibility::text, 'same') || '|' || updated_at::date from public.user_places where place_id = 'f9000000-0000-0000-0000-000000000003'), 'same|2025-01-01', 'updated_at 그대로');

-- 평가보다 넓어지지 않음 — 평가가 팔로워면 메모 전체여도 모르는 사람은 평가부터 못 봄
update public.user_places set visibility = 'followers', note_visibility = 'public' where place_id = 'f9000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select count(*)::int from public.place_ratings('f9000000-0000-0000-0000-000000000001')), 0, '평가를 못 보면 메모도 못 봄');
select set_config('request.jwt.claims', '{"sub":"f2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select note from public.place_ratings('f9000000-0000-0000-0000-000000000001') limit 1), '같게 메모', '팔로워는 평가와 메모 모두');
reset role;

-- 로그인 안 한 사람 — 전체 공개 평가의 평가와 같게 · 전체 메모만, 팔로워 메모는 빈 값
update public.user_places set visibility = 'public', note_visibility = null where place_id = 'f9000000-0000-0000-0000-000000000001';
set local role anon;
select set_config('request.jwt.claims', '', true);
select is((select note from public.profile_ratings('f1111111-1111-1111-1111-111111111111') where place_id = 'f9000000-0000-0000-0000-000000000001'), '같게 메모', '로그인 안 해도 평가와 같게(전체) 메모는 보임');
select is((select note from public.profile_ratings('f1111111-1111-1111-1111-111111111111') where place_id = 'f9000000-0000-0000-0000-000000000002'), '', '로그인 안 하면 팔로워 메모는 빈 값');
reset role;

-- 가져오기 · 새로 고침(장소를 고른 경우)은 좁히기만 — 나만으로 둔 메모가 다시 가져오며 넓어지지 않음
update public.user_places set note_visibility = 'private' where place_id = 'f9000000-0000-0000-0000-000000000003';
select is(public.set_imported_note_visibility('f1111111-1111-1111-1111-111111111111', null, array['f9000000-0000-0000-0000-000000000003'::uuid]), 0, '다시 가져와도 넓어지지 않음');
update public.user_places set note_visibility = null where place_id = 'f9000000-0000-0000-0000-000000000003';
select is(public.set_imported_note_visibility('f1111111-1111-1111-1111-111111111111', 'followers', array['f9000000-0000-0000-0000-000000000003'::uuid]), 1, '좁히기는 됨');

-- 별명만 있는 곳도 메모 공개 범위를 따른다 (68-7)
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine) values ('f9000000-0000-0000-0000-000000000005', 'naver', 'nv-5', '별명만', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, note, visibility) values ('f1111111-1111-1111-1111-111111111111', 'f9000000-0000-0000-0000-000000000005', 'two', '', 'public');
insert into public.imported_items (user_id, source, source_list_id, source_place_id, place_id, list_name, memo, alias) values
  ('f1111111-1111-1111-1111-111111111111', 'naver', 'l', 'nv-5', 'f9000000-0000-0000-0000-000000000005', '리스트', '', '비밀 별명');
select is(public.set_imported_note_visibility('f1111111-1111-1111-1111-111111111111', 'private', array['f9000000-0000-0000-0000-000000000005'::uuid]), 1, '별명만 있는 곳도 메모 공개 범위 적용');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f3333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select is((select alias from public.place_ratings('f9000000-0000-0000-0000-000000000005') limit 1), '', '나만이면 별명도 남에게 빈 값');
reset role;

select * from finish();
rollback;
