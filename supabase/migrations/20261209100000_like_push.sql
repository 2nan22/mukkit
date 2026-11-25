-- 71 좋아요 푸시 — 설정 › 알림에서 끌 수 있게 push_off 에 like
alter table public.profiles drop constraint profiles_push_off_check;
alter table public.profiles add constraint profiles_push_off_check
  check (push_off <@ array['meetup', 'comment', 'like', 'visit', 'follow']::text[]);
