-- 메모 공개 손질 (68-4 검토) — 직접 끈 메모를 한 번에 공개가 다시 켜지 않게 · 빈 메모는 공개로 두지 않게
-- note_public: null 정하지 않음(기본) · true 공개 · false 직접 끔. 한 번에 공개는 null 인 곳만
alter table public.user_places alter column note_public drop not null, alter column note_public set default null;
update public.user_places set note_public = null where note_public = false;

-- 빈 메모는 공개로 두지 않는다 — 나중에 원본 메모가 들어와 묻지 않고 나가지 않게. 모든 경로(가져오기 · 새로 고침 · 평가)에 걸리게 트리거로
create function public.user_places_note_public_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.note_public and btrim(coalesce(new.note, '')) = '' then
    new.note_public := null;
  end if;
  return new;
end
$$;
create trigger user_places_note_public_guard
  before insert or update of note, note_public on public.user_places
  for each row execute function public.user_places_note_public_guard();

create or replace function public.publish_imported_notes(p_user uuid, p_places uuid[] default null)
returns int language sql security invoker set search_path = '' as $$
  with done as (
    update public.user_places up
       set note_public = true
     where up.user_id = p_user
       and (p_places is null or up.place_id = any (p_places))
       and up.tier in ('three', 'two', 'one', 'not_recommended')
       and up.note_public is null
       and btrim(up.note) <> ''
       and exists (
         select 1 from public.imported_items i
          where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
       )
    returning 1
  )
  select count(*)::int from done
$$;

create or replace function public.count_unpublished_imported_notes(p_user uuid)
returns int language sql stable security invoker set search_path = '' as $$
  select count(*)::int from public.user_places up
   where up.user_id = p_user
     and up.tier in ('three', 'two', 'one', 'not_recommended')
     and up.note_public is null
     and btrim(up.note) <> ''
     and exists (
       select 1 from public.imported_items i
        where i.user_id = up.user_id and i.place_id = up.place_id and left(i.memo, 300) = up.note
     )
$$;

-- 전 버전처럼 로그인한 사람만
revoke execute on function public.rating_detail(uuid, uuid) from anon;
