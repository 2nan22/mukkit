-- 앱 안 알림함 — 트리거로 생성 · 받는 사람만 · 좋아요는 하나로 · 풀면 지움 · 차단한 사이 제외
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('d7111111-1111-1111-1111-111111111111', 'nt-a@test.local'),
  ('d7222222-2222-2222-2222-222222222222', 'nt-b@test.local'),
  ('d7333333-3333-3333-3333-333333333333', 'nt-c@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
  values ('a9800000-0000-0000-0000-000000000001', 'kakao', 'nt-1', '알림검사식당', 37.5, 127.0, 'korean');
insert into public.user_places (user_id, place_id, tier, visibility)
  values ('d7111111-1111-1111-1111-111111111111', 'a9800000-0000-0000-0000-000000000001', 'three', 'public');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d7222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
insert into public.follows (follower_id, followee_id) values ('d7222222-2222-2222-2222-222222222222', 'd7111111-1111-1111-1111-111111111111');
insert into public.rating_likes (user_id, owner_id, place_id) values ('d7222222-2222-2222-2222-222222222222', 'd7111111-1111-1111-1111-111111111111', 'a9800000-0000-0000-0000-000000000001');
delete from public.rating_likes where user_id = 'd7222222-2222-2222-2222-222222222222';
insert into public.rating_likes (user_id, owner_id, place_id) values ('d7222222-2222-2222-2222-222222222222', 'd7111111-1111-1111-1111-111111111111', 'a9800000-0000-0000-0000-000000000001');
insert into public.rating_comments (owner_id, place_id, author_id, body) values ('d7111111-1111-1111-1111-111111111111', 'a9800000-0000-0000-0000-000000000001', 'd7222222-2222-2222-2222-222222222222', '맛있어 보여요');
select throws_ok($$insert into public.notifications (user_id, kind, actor_id) values ('d7111111-1111-1111-1111-111111111111', 'follow', 'd7222222-2222-2222-2222-222222222222')$$, '42501', null, '알림은 직접 만들 수 없음');
select is((select count(*)::int from public.my_notifications()), 0, '보낸 사람에겐 알림 없음');

select set_config('request.jwt.claims', '{"sub":"d7111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select string_agg(kind, ',' order by kind) from public.my_notifications()), 'comment,follow,like', '팔로우 · 좋아요(눌렀다 풀었다 다시 눌러도 하나) · 댓글');
select is((select place_name from public.my_notifications() where kind = 'like'), '알림검사식당', '장소 이름이 붙음');
select is(public.unread_notifications(), 3, '안 읽음 3');
update public.notifications set read_at = now() where kind = 'follow';
select is(public.unread_notifications(), 2, '읽음 표시 반영');

-- 평가 주인이 답하면 앞서 댓글 단 사람에게
insert into public.rating_comments (owner_id, place_id, author_id, body) values ('d7111111-1111-1111-1111-111111111111', 'a9800000-0000-0000-0000-000000000001', 'd7111111-1111-1111-1111-111111111111', '꼭 가 보세요');
select set_config('request.jwt.claims', '{"sub":"d7222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select kind from public.my_notifications()), 'comment', '주인의 답글은 앞서 댓글 단 사람에게');

-- 좋아요를 풀면 알림도 사라짐
delete from public.rating_likes where user_id = 'd7222222-2222-2222-2222-222222222222';
select set_config('request.jwt.claims', '{"sub":"d7111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.my_notifications() where kind = 'like'), 0, '좋아요 풀면 알림 지움');

-- 차단하면 그 사람 알림은 안 보임
reset role;
insert into public.blocks (blocker_id, blocked_id) values ('d7111111-1111-1111-1111-111111111111', 'd7222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d7111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.my_notifications()), 0, '차단한 사람의 알림은 안 보임');

select * from finish();
rollback;
