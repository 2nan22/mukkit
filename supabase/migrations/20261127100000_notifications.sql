-- 앱 안 알림함 (27) — 푸시를 놓쳐도 다시 볼 수 있게. 받는 사람만 보고, 차단한 사이의 알림은 보이지 않는다
-- 쓰기는 트리거만(사용자가 직접 만들 수 없음) — 댓글 · 좋아요 · 팔로우 · 약속 초대 · 약속 참여 · 함께 방문 요청
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('comment', 'like', 'follow', 'meetup_invite', 'meetup_join', 'visit_tag')),
  actor_id uuid not null references public.profiles (id) on delete cascade,
  -- 평가(댓글 · 좋아요) — 평가 주인 · 장소
  owner_id uuid references public.profiles (id) on delete cascade,
  place_id uuid references public.places (id) on delete cascade,
  meetup_id uuid references public.meetups (id) on delete cascade,
  visit_id uuid references public.visits (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (user_id <> actor_id)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
-- 좋아요 · 팔로우는 같은 사람이 눌렀다 풀었다 해도 하나로
create unique index notifications_like_once on public.notifications (user_id, actor_id, owner_id, place_id) where kind = 'like';
create unique index notifications_follow_once on public.notifications (user_id, actor_id) where kind = 'follow';
alter table public.notifications enable row level security;
create policy "알림은 받은 사람만 봄" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "읽음 표시는 받은 사람만" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "알림 지우기는 받은 사람만" on public.notifications for delete to authenticated using (user_id = (select auth.uid()));

-- 알림 만들기 — 자기 자신 · 차단한 사이는 건너뜀
create function public.notify(p_user uuid, p_kind text, p_actor uuid, p_owner uuid default null, p_place uuid default null, p_meetup uuid default null, p_visit uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null or p_actor is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.blocks b where (b.blocker_id = p_user and b.blocked_id = p_actor) or (b.blocker_id = p_actor and b.blocked_id = p_user)) then return; end if;
  if p_kind = 'like' then
    insert into public.notifications (user_id, kind, actor_id, owner_id, place_id)
    values (p_user, 'like', p_actor, p_owner, p_place)
    on conflict (user_id, actor_id, owner_id, place_id) where kind = 'like' do update set created_at = now(), read_at = null;
  elsif p_kind = 'follow' then
    insert into public.notifications (user_id, kind, actor_id)
    values (p_user, 'follow', p_actor)
    on conflict (user_id, actor_id) where kind = 'follow' do update set created_at = now(), read_at = null;
  else
    insert into public.notifications (user_id, kind, actor_id, owner_id, place_id, meetup_id, visit_id)
    values (p_user, p_kind, p_actor, p_owner, p_place, p_meetup, p_visit);
  end if;
end;
$$;
revoke execute on function public.notify(uuid, text, uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- 댓글 — 남이 쓰면 평가 주인에게, 주인이 쓰면 앞서 댓글 단 사람들에게 (푸시와 같은 규칙)
create function public.on_comment_notify() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.author_id <> new.owner_id then
    perform public.notify(new.owner_id, 'comment', new.author_id, new.owner_id, new.place_id);
  else
    for r in select distinct c.author_id from public.rating_comments c
             where c.owner_id = new.owner_id and c.place_id = new.place_id and c.author_id <> new.owner_id loop
      perform public.notify(r.author_id, 'comment', new.author_id, new.owner_id, new.place_id);
    end loop;
  end if;
  return new;
end;
$$;
create trigger rating_comments_notify after insert on public.rating_comments for each row execute function public.on_comment_notify();

create function public.on_like_notify() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.notify(new.owner_id, 'like', new.user_id, new.owner_id, new.place_id);
    return new;
  end if;
  -- 좋아요를 풀면 알림도 지움
  delete from public.notifications n where n.kind = 'like' and n.user_id = old.owner_id and n.actor_id = old.user_id and n.owner_id = old.owner_id and n.place_id = old.place_id;
  return old;
end;
$$;
create trigger rating_likes_notify after insert or delete on public.rating_likes for each row execute function public.on_like_notify();

create function public.on_follow_notify() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.followee_id, 'follow', new.follower_id);
  return new;
end;
$$;
create trigger follows_notify after insert on public.follows for each row execute function public.on_follow_notify();

-- 약속 초대 — 초대한 사람(요청한 사용자, 없으면 만든 사람)
create function public.on_meetup_invite_notify() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify(new.user_id, 'meetup_invite', coalesce((select auth.uid()), (select m.host_id from public.meetups m where m.id = new.meetup_id)), null, null, new.meetup_id);
  return new;
end;
$$;
create trigger meetup_invites_notify after insert on public.meetup_invites for each row execute function public.on_meetup_invite_notify();

-- 약속 참여 — 만든 사람에게
create function public.on_meetup_join_notify() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify((select m.host_id from public.meetups m where m.id = new.meetup_id), 'meetup_join', new.user_id, null, null, new.meetup_id);
  return new;
end;
$$;
create trigger meetup_members_notify after insert on public.meetup_members for each row execute function public.on_meetup_join_notify();

-- 함께 방문 요청 — 태그된 사용자에게
create function public.on_visit_tag_notify() returns trigger language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if new.user_id is null or new.status <> 'invited' then return new; end if;
  select created_by, place_id into v from public.visits where id = new.visit_id;
  perform public.notify(new.user_id, 'visit_tag', v.created_by, null, v.place_id, null, new.visit_id);
  return new;
end;
$$;
create trigger visit_members_notify after insert on public.visit_members for each row execute function public.on_visit_tag_notify();

revoke execute on function public.on_comment_notify() from public, anon, authenticated;
revoke execute on function public.on_like_notify() from public, anon, authenticated;
revoke execute on function public.on_follow_notify() from public, anon, authenticated;
revoke execute on function public.on_meetup_invite_notify() from public, anon, authenticated;
revoke execute on function public.on_meetup_join_notify() from public, anon, authenticated;
revoke execute on function public.on_visit_tag_notify() from public, anon, authenticated;

-- 알림함 — 차단한 사이 · 볼 수 없게 된 평가의 알림은 빼고, 보낸 사람 닉네임 · 장소 이름을 붙여서
create function public.my_notifications(p_limit int default 50)
returns table (id uuid, kind text, actor_id uuid, actor_nickname text, owner_id uuid, place_id uuid, place_name text, meetup_id uuid, visit_id uuid, created_at timestamptz, read boolean)
language sql stable security definer set search_path = '' as $$
  select n.id, n.kind, n.actor_id, pr.nickname, n.owner_id, n.place_id, pl.name, n.meetup_id, n.visit_id, n.created_at, n.read_at is not null
  from public.notifications n
  join public.profiles pr on pr.id = n.actor_id
  left join public.places pl on pl.id = n.place_id
  where n.user_id = (select auth.uid())
    and n.actor_id not in (select public.my_block_ids())
    and (n.kind not in ('comment', 'like') or public.is_viewable_rating(n.owner_id, n.place_id))
  order by n.created_at desc
  limit least(p_limit, 100)
$$;
revoke execute on function public.my_notifications(int) from public, anon;
grant execute on function public.my_notifications(int) to authenticated;

create function public.unread_notifications() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.notifications n
  where n.user_id = (select auth.uid()) and n.read_at is null
    and n.actor_id not in (select public.my_block_ids())
$$;
revoke execute on function public.unread_notifications() from public, anon;
grant execute on function public.unread_notifications() to authenticated;
