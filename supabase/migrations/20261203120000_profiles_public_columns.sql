-- 프로필은 보여 줄 칸만 공개 — 가입 단계 · 알림 설정은 my_profile_flags 로 본인만
-- 옛 코드가 이 칸들을 직접 읽으므로 my_profile_flags 를 쓰는 코드가 배포된 뒤에 적용한다
revoke select on public.profiles from anon, authenticated;
grant select (id, nickname, bio, avatar_url, created_at) on public.profiles to anon, authenticated;
