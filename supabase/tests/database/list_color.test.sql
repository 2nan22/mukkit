-- 리스트 색: 새 리스트는 아직 안 쓴 색부터 · 고른 색은 그대로 · 팔레트 밖 색은 거절
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('cccccccc-0000-0000-0000-00000000c010', 'color@test.local');
insert into public.lists (owner_id, name) values ('cccccccc-0000-0000-0000-00000000c010', '첫째');
insert into public.lists (owner_id, name) values ('cccccccc-0000-0000-0000-00000000c010', '둘째');
insert into public.lists (owner_id, name, color) values ('cccccccc-0000-0000-0000-00000000c010', '셋째', 'brown');

select is((select color from public.lists where name = '첫째' and owner_id = 'cccccccc-0000-0000-0000-00000000c010'), 'green', '첫 리스트는 팔레트 첫 색');
select is((select color from public.lists where name = '둘째' and owner_id = 'cccccccc-0000-0000-0000-00000000c010'), 'teal', '둘째는 안 쓴 다음 색');
select is((select color from public.lists where name = '셋째' and owner_id = 'cccccccc-0000-0000-0000-00000000c010'), 'brown', '고른 색은 그대로');
select throws_ok(
  $$insert into public.lists (owner_id, name, color) values ('cccccccc-0000-0000-0000-00000000c010', '넷째', 'red')$$,
  '23514', null, '등급과 겹치는 색은 거절');

select * from finish();
rollback;
