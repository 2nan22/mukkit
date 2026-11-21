-- 약관 · 처리방침 동의 기록과 탈퇴

alter table public.profiles
  add column terms_agreed_at timestamptz,
  add column terms_version text;

-- 탈퇴 — 내 계정만 지운다. 프로필 · 평가 · 메모 · 리스트 · 팔로우 · 가져온 원본은 외래키 연쇄로 함께 삭제
-- Storage 파일은 보호 트리거로 여기서 못 지우므로 호출 전에 앱이 먼저 지운다
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 내 폴더의 파일은 내가 볼 수 있다 — 평가에 아직 안 붙은 파일까지 탈퇴 때 찾아 지우려고
create policy "미디어 내 폴더는 내가 봄" on storage.objects for select to authenticated
  using (bucket_id = 'rating-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
