-- 기본 공개 범위 (87, 사용자 2026-11-27 '매번 마이그레이션 하는 기분') — 새로 저장 · 가져오는 곳이 늘 '나만'으로 들어가
-- 설정에서 한 번에 바꾸기를 되풀이하던 것. 계정마다 기본값을 두고 새 user_places 에 넣는다 (메모는 평가 공개 범위를 따름)

-- null = 아직 안 정함 (가져오기가 묻는다) · 정하면 새로 저장하는 곳에 씀
alter table public.profiles add column default_visibility public.rating_visibility;

-- 지금까지 평가에 가장 많이 쓴 범위가 '나만'이 아니면 그것을 기본값으로 (같으면 좁은 쪽)
update public.profiles p
   set default_visibility = s.v
  from (
    select distinct on (user_id) user_id, visibility as v
      from public.user_places
     where tier in ('three', 'two', 'one', 'not_recommended')
     group by user_id, visibility
     order by user_id, count(*) desc, visibility
  ) s
 where s.user_id = p.id and s.v <> 'private';

-- 공개 범위를 넣지 않은 새 줄은 계정 기본값으로 — 직접 넣은 값은 그대로
-- 칸 기본값을 지워야 '안 넣음'(null)과 '나만'을 구분할 수 있다 (not null 은 BEFORE 트리거 뒤에 검사)
alter table public.user_places alter column visibility drop default;

create function public.user_places_default_visibility()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.visibility is null then
    new.visibility := coalesce((select p.default_visibility from public.profiles p where p.id = new.user_id), 'private');
  end if;
  return new;
end
$$;
revoke execute on function public.user_places_default_visibility() from public, anon, authenticated;

create trigger user_places_default_visibility
  before insert on public.user_places
  for each row execute function public.user_places_default_visibility();

-- 본인 기본값 읽기 · 바꾸기 — profiles 의 이 칸은 공개 읽기에서 빠져 있다
create function public.my_default_visibility()
returns public.rating_visibility language sql stable security definer set search_path = '' as $$
  select p.default_visibility from public.profiles p where p.id = (select auth.uid())
$$;
revoke all on function public.my_default_visibility() from public, anon;
grant execute on function public.my_default_visibility() to authenticated;

create function public.set_default_visibility(p_vis public.rating_visibility)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set default_visibility = p_vis where id = (select auth.uid())
$$;
revoke all on function public.set_default_visibility(public.rating_visibility) from public, anon;
grant execute on function public.set_default_visibility(public.rating_visibility) to authenticated;

-- 68-5 전에 만든 원본은 '메모는 늘 나만' 시절 값(private)이 옮겨진 것 — 사용자가 고른 값이 아니라 새벽 새로 고침마다
-- 새 메모를 나만으로 넣고 있었다. 평가와 같게(null)로 돌린다 (68-5 배포 2026-11-25 이후 만든 원본은 고른 값 그대로)
update public.import_sources set note_visibility = null
 where note_visibility = 'private' and created_at < '2026-11-25';
