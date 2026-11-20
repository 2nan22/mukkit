-- 닉네임은 사용자가 직접 정하고, 대소문자 무시 중복 금지
alter table public.profiles add column nickname_set_at timestamptz;

-- 이미 생긴 기본 닉네임이 겹치지 않게 아이디 앞 8자로 다시 매긴다 (아직 직접 정한 사람 없음)
update public.profiles set nickname = '사용자' || left(replace(id::text, '-', ''), 8);

alter table public.profiles drop constraint profiles_nickname_check;
alter table public.profiles add constraint profiles_nickname_length check (char_length(nickname) between 2 and 12);
create unique index profiles_nickname_lower_key on public.profiles (lower(nickname));

-- 가입 때는 겹치지 않는 기본 닉네임만 만든다 — 공급자 이름은 정하기 화면에서 제안으로만 쓴다
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base text := replace(new.id::text, '-', '');
  candidate text := '사용자' || left(base, 8);
begin
  if exists (select 1 from public.profiles where lower(nickname) = lower(candidate)) then
    candidate := '사용자' || substr(base, 9, 8);
  end if;
  insert into public.profiles (id, nickname) values (new.id, candidate);
  return new;
end;
$$;
