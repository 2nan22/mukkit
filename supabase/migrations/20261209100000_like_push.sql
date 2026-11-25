-- 71 좋아요 푸시 — 설정 › 알림에서 끌 수 있게 push_off 에 like
alter table public.profiles drop constraint profiles_push_off_check;
alter table public.profiles add constraint profiles_push_off_check
  check (push_off <@ array['meetup', 'comment', 'like', 'visit', 'follow']::text[]);

-- 좋아요 푸시 고르기 — 30분 간격 확인과 pushed_at 찍기를 한 번에 (같은 사람이 잇달아 누를 때 두 번 나가지 않게)
-- 방금(2분 안) 생긴 아직 안 보낸 줄이 있고, 같은 사람 → 같은 주인 좋아요 푸시가 30분 안에 없을 때만 true
create function public.claim_like_push(p_actor uuid, p_owner uuid, p_place uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('like_push:' || p_actor::text || ':' || p_owner::text));
  if exists (
    select 1 from public.notifications
    where kind = 'like' and actor_id = p_actor and user_id = p_owner and pushed_at > now() - interval '30 minutes'
  ) then
    return false;
  end if;
  update public.notifications set pushed_at = now()
  where kind = 'like' and actor_id = p_actor and user_id = p_owner and place_id = p_place
    and pushed_at is null and created_at > now() - interval '2 minutes'
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke execute on function public.claim_like_push(uuid, uuid, uuid) from public, anon, authenticated;
