-- 푸시 구독 — 본인 것만
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('81111111-1111-1111-1111-111111111111', 'push-a@test.local'),
  ('82222222-2222-2222-2222-222222222222', 'push-b@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"81111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('81111111-1111-1111-1111-111111111111', 'https://push.example/a', 'k', 'a');
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('82222222-2222-2222-2222-222222222222', 'https://push.example/b', 'k', 'a')$$,
  '42501', null, '남의 구독은 못 넣음');
select throws_ok(
  $$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ('81111111-1111-1111-1111-111111111111', 'http://insecure', 'k', 'a')$$,
  '23514', null, 'https 주소만');

select set_config('request.jwt.claims', '{"sub":"82222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*)::int from public.push_subscriptions), 0, '남의 구독은 안 보임');
delete from public.push_subscriptions;
reset role;
select is((select count(*)::int from public.push_subscriptions where user_id = '81111111-1111-1111-1111-111111111111'), 1, '남의 구독은 못 지움');

select * from finish();
rollback;
