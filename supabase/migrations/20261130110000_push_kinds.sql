-- 알림 종류별로 끄기 (42) — 끈 종류만 적는다(기본은 모두 켬). 기기 알림 자체는 push_subscriptions 로 켜고 끔
-- meetup 약속 · comment 댓글 · visit 함께 방문 태그 (좋아요 · 팔로우는 푸시가 없다)
alter table public.profiles
  add column push_off text[] not null default '{}'
  check (push_off <@ array['meetup', 'comment', 'visit']::text[]);
