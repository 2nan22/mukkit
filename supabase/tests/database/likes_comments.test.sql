-- 좋아요 · 댓글 — 볼 수 있는 평가에만 · 차단 · 숨김 · 지우기 권한
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'lc-a@test.local'),
  ('c2222222-2222-2222-2222-222222222222', 'lc-b@test.local'),
  ('c3333333-3333-3333-3333-333333333333', 'lc-c@test.local'),
  ('c4444444-4444-4444-4444-444444444444', 'lc-d@test.local'),
  ('c5555555-5555-5555-5555-555555555555', 'lc-e@test.local');
insert into public.places (id, source, source_place_id, name, lat, lng, cuisine)
  values ('a9300000-0000-0000-0000-000000000001', 'kakao', 'lc-test-1', '반응검사식당', 37.5, 127.0, 'korean');
-- A 공개 평가 · B 나만 평가 · C 가고 싶은 곳(평가 아님)
insert into public.user_places (user_id, place_id, tier, visibility) values
  ('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'three', 'public'),
  ('c2222222-2222-2222-2222-222222222222', 'a9300000-0000-0000-0000-000000000001', 'two', 'private'),
  ('c3333333-3333-3333-3333-333333333333', 'a9300000-0000-0000-0000-000000000001', 'want_to_go', 'public');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select lives_ok($$insert into public.rating_likes (user_id, owner_id, place_id) values ('c2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001')$$, '공개 평가에 좋아요');
select lives_ok($$insert into public.rating_comments (owner_id, place_id, author_id, body) values ('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', '저도 가볼게요')$$, '공개 평가에 댓글');
select throws_ok($$insert into public.rating_comments (owner_id, place_id, author_id, body) values ('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', '   ')$$, '23514', null, '빈 댓글은 안 됨');

select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select throws_ok($$insert into public.rating_likes (user_id, owner_id, place_id) values ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'a9300000-0000-0000-0000-000000000001')$$, '42501', null, '나만 공개 평가엔 좋아요 못 함');
select throws_ok($$insert into public.rating_comments (owner_id, place_id, author_id, body) values ('c3333333-3333-3333-3333-333333333333', 'a9300000-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', '?')$$, '42501', null, '평가가 아닌 저장에는 댓글 못 함');
select throws_ok($$insert into public.rating_likes (user_id, owner_id, place_id) values ('c1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001')$$, '23514', null, '내 평가엔 좋아요 못 함');
select lives_ok($$insert into public.rating_comments (owner_id, place_id, author_id, body) values ('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'c1111111-1111-1111-1111-111111111111', '꼭 가보세요')$$, '평가 주인도 댓글');
select is((select row(likes, liked, comments)::text from public.rating_reactions(array['c1111111-1111-1111-1111-111111111111'::uuid], array['a9300000-0000-0000-0000-000000000001'::uuid])), '(1,f,2)', '좋아요 1 · 내가 안 누름 · 댓글 2');
select is((select count(*)::int from public.rating_comments_of('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001') where can_delete), 2, '평가 주인은 댓글 모두 지울 수 있음');

-- 차단하면 그 사람 댓글은 내게 안 보이고, 나는 그 사람 평가에 못 씀
reset role;
insert into public.blocks (blocker_id, blocked_id) values ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*)::int from public.rating_comments_of('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001')), 1, '차단한 사람 댓글은 안 보임');
select set_config('request.jwt.claims', '{"sub":"c2222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select throws_ok($$insert into public.rating_comments (owner_id, place_id, author_id, body) values ('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001', 'c2222222-2222-2222-2222-222222222222', '또')$$, '42501', null, '차단당하면 댓글 못 씀');
reset role;
delete from public.blocks;

-- 남의 댓글은 못 지움 (쓴 사람 · 평가 주인만)
insert into public.user_places (user_id, place_id, tier, visibility) values ('c4444444-4444-4444-4444-444444444444', 'a9300000-0000-0000-0000-000000000001', 'one', 'public');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
delete from public.rating_comments where author_id = 'c2222222-2222-2222-2222-222222222222';
reset role;
select is((select count(*)::int from public.rating_comments where author_id = 'c2222222-2222-2222-2222-222222222222'), 1, '남의 댓글은 지워지지 않음');
-- 평가 주인은 남의 댓글을 지울 수 있음
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
delete from public.rating_comments where author_id = 'c1111111-1111-1111-1111-111111111111';
reset role;
select is((select count(*)::int from public.rating_comments where author_id = 'c1111111-1111-1111-1111-111111111111'), 0, '쓴 사람은 내 댓글을 지움');

-- 3명이 신고한 댓글은 숨김 · 평가 숨김에는 세지 않음
insert into public.reports (reporter_id, target_user, target_comment, reason)
  select r, 'c2222222-2222-2222-2222-222222222222', (select id from public.rating_comments where author_id = 'c2222222-2222-2222-2222-222222222222'), 'harassment'
  from unnest(array['c3333333-3333-3333-3333-333333333333', 'c4444444-4444-4444-4444-444444444444', 'c5555555-5555-5555-5555-555555555555']::uuid[]) r;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c4444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
select is((select count(*)::int from public.rating_comments_of('c1111111-1111-1111-1111-111111111111', 'a9300000-0000-0000-0000-000000000001')), 0, '3명 신고한 댓글은 숨김');
select is((select comments from public.rating_reactions(array['c1111111-1111-1111-1111-111111111111'::uuid], array['a9300000-0000-0000-0000-000000000001'::uuid])), 0, '댓글 수에서도 빠짐');
reset role;
select ok(not public.is_rating_hidden('c2222222-2222-2222-2222-222222222222', 'a9300000-0000-0000-0000-000000000001'), '댓글 신고는 평가 숨김에 안 셈');

select * from finish();
rollback;
