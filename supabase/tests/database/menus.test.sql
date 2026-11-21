-- 먹은 메뉴 — 개수 제한 · 공개 평가로만 남에게 보임
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 'mn-a@test.local'),
  ('a2222222-2222-2222-2222-222222222222', 'mn-b@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
  values ('a9100000-0000-0000-0000-000000000001', 'kakao', 'mn-test-1', '메뉴검사식당', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, visibility, menus)
  values ('a1111111-1111-1111-1111-111111111111', 'a9100000-0000-0000-0000-000000000001', 'two', 'private', array['칼국수', '수육']);

select throws_ok(
  $$update public.user_places set menus = array['1','2','3','4','5','6','7','8','9','10','11'] where user_id = 'a1111111-1111-1111-1111-111111111111'$$,
  '23514', null, '메뉴는 10개까지');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.place_ratings('a9100000-0000-0000-0000-000000000001')), 0, '나만 공개면 메뉴도 안 보임');
reset role;
update public.user_places set visibility = 'public' where user_id = 'a1111111-1111-1111-1111-111111111111';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select menus from public.place_ratings('a9100000-0000-0000-0000-000000000001')), array['칼국수', '수육'], '공개 평가면 먹은 메뉴가 보임');

select * from finish();
rollback;
