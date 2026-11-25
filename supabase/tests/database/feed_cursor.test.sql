-- 피드 더 보기 (70) — 같은 시각 평가가 많아도 두 쪽에 걸쳐 빠짐 · 겹침 없이
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('fc111111-1111-1111-1111-111111111111', 'fc-me@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
select ('fc900000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'naver', 'fc-' || i, '같은 시각 ' || i, 37.5, 127.0, 'korean'
  from generate_series(1, 25) i;
insert into public.user_places (user_id, place_id, tier, visibility, updated_at)
select 'fc111111-1111-1111-1111-111111111111', ('fc900000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'two', 'public', '2020-05-05 12:00+09'
  from generate_series(1, 25) i;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
create temp table p1 as select * from public.feed(null, 20, true);
create temp table last1 as select updated_at, owner_id, place_id from p1 order by updated_at, owner_id, place_id limit 1;
create temp table p2 as select f.* from last1 l, public.feed(l.updated_at, 20, true, l.owner_id, l.place_id) f;
select is((select count(*)::int from p1), 20, '첫 쪽 20곳');
select is((select count(*)::int from p2), 5, '다음 쪽 나머지 5곳');
select is((select count(distinct place_id)::int from (select place_id from p1 union all select place_id from p2) x), 25, '겹침 · 빠짐 없이 25곳');
reset role;

select * from finish();
rollback;
