-- 약속 이름 (96) — 비우면 화면이 목적 · 함께하는 사람으로 이름을 짓는다
alter table public.meetups add column title text
  check (title is null or char_length(btrim(title)) between 1 and 30);
-- 이름은 참여자 누구나 고친다 (목적 · 시간과 같은 정책 '약속 수정은 참여자만')
grant update (title) on public.meetups to authenticated;
