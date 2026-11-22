-- 운영 DB 점검(supabase db advisors) 반영 — 의도한 공개 읽기 함수는 그대로 두고 아래만 닫는다
-- 트리거 함수는 RPC 로 부를 일이 없다 (트리거 실행에는 EXECUTE 권한이 필요 없음)
revoke execute on function public.add_meetup_host() from public, anon, authenticated;
revoke execute on function public.add_visit_creator() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 참여 · 태그 확인 함수는 로그인한 사람의 정책에서만 쓴다
revoke execute on function public.is_meetup_member(uuid) from public, anon;
revoke execute on function public.is_meetup_invitee(uuid) from public, anon;
revoke execute on function public.is_visit_creator(uuid) from public, anon;
revoke execute on function public.is_visit_member(uuid) from public, anon;
grant execute on function public.is_meetup_member(uuid) to authenticated;
grant execute on function public.is_meetup_invitee(uuid) to authenticated;
grant execute on function public.is_visit_creator(uuid) to authenticated;
grant execute on function public.is_visit_member(uuid) to authenticated;

alter function public.tier_score(public.tier) set search_path = '';
