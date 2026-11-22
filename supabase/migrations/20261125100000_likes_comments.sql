-- 좋아요 · 댓글 (21)
-- 대상은 평가 하나(user_places 행) — 가게 단위 집계는 만들지 않는다
-- 평가를 볼 수 있는 사람만 누르고 쓴다(can_view_rating — 공개 범위 · 차단 · 신고 숨김이 그대로 적용)

-- 평가로 친 등급이고, 보는 사람이 볼 수 있는가
create function public.is_viewable_rating(p_owner uuid, p_place uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_places up
    where up.user_id = p_owner and up.place_id = p_place
      and up.tier in ('three', 'two', 'one', 'not_recommended')
  ) and public.can_view_rating(p_owner, p_place);
$$;
revoke execute on function public.is_viewable_rating(uuid, uuid) from public, anon;
grant execute on function public.is_viewable_rating(uuid, uuid) to authenticated;

create table public.rating_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null,
  place_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, owner_id, place_id),
  foreign key (owner_id, place_id) references public.user_places (user_id, place_id) on delete cascade,
  check (user_id <> owner_id)
);
create index rating_likes_target_idx on public.rating_likes (owner_id, place_id);
alter table public.rating_likes enable row level security;
create policy "좋아요는 볼 수 있는 평가에 내가 누름" on public.rating_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_viewable_rating(owner_id, place_id));
create policy "좋아요 취소는 내 것만" on public.rating_likes for delete to authenticated using (user_id = (select auth.uid()));
create policy "좋아요는 내 것만 봄" on public.rating_likes for select to authenticated using (user_id = (select auth.uid()));

create table public.rating_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  place_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now(),
  foreign key (owner_id, place_id) references public.user_places (user_id, place_id) on delete cascade
);
create index rating_comments_target_idx on public.rating_comments (owner_id, place_id, created_at);
alter table public.rating_comments enable row level security;
create policy "댓글은 볼 수 있는 평가에 내가 씀" on public.rating_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_viewable_rating(owner_id, place_id));
-- 지우기는 쓴 사람, 또는 평가 주인
create policy "댓글 삭제는 쓴 사람 · 평가 주인" on public.rating_comments for delete to authenticated
  using (author_id = (select auth.uid()) or owner_id = (select auth.uid()));
-- 화면 읽기는 rating_comments_of 함수로 (차단 · 숨김 거르기). 원본 행은 쓴 사람 · 평가 주인만 — 지우기(delete … where)에 필요
create policy "댓글 원본은 쓴 사람 · 평가 주인만" on public.rating_comments for select to authenticated
  using (author_id = (select auth.uid()) or owner_id = (select auth.uid()));

-- 댓글 신고 — reports 에 칸 추가. 댓글 신고는 평가 숨김 · 대표 사진 판단에 세지 않는다
alter table public.reports add column target_comment uuid references public.rating_comments (id) on delete cascade;
drop index public.reports_once_idx;
create unique index reports_once_idx on public.reports (
  reporter_id, target_user,
  coalesce(target_place, '00000000-0000-0000-0000-000000000000'),
  coalesce(target_comment, '00000000-0000-0000-0000-000000000000')
);

create or replace function public.is_rating_hidden(p_owner uuid, p_place uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(distinct r.reporter_id) from public.reports r
          where r.target_user = p_owner and r.target_place = p_place and r.target_comment is null) >= 3;
$$;

-- 서로 다른 3명 이상이 신고한 댓글은 숨김
create function public.is_comment_hidden(p_comment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select count(distinct r.reporter_id) from public.reports r where r.target_comment = p_comment) >= 3;
$$;
revoke execute on function public.is_comment_hidden(uuid) from public, anon;

-- 평가 여러 개의 좋아요 수 · 내가 눌렀나 · 댓글 수 (owners[i], places[i] 짝)
create function public.rating_reactions(p_owners uuid[], p_places uuid[])
returns table (owner_id uuid, place_id uuid, likes int, liked boolean, comments int)
language sql stable security definer set search_path = '' as $$
  select k.o, k.p,
         (select count(*)::int from public.rating_likes l where l.owner_id = k.o and l.place_id = k.p),
         exists (select 1 from public.rating_likes l where l.owner_id = k.o and l.place_id = k.p and l.user_id = (select auth.uid())),
         (select count(*)::int from public.rating_comments c
          where c.owner_id = k.o and c.place_id = k.p
            and c.author_id not in (select public.my_block_ids())
            and not public.is_comment_hidden(c.id))
  from unnest(p_owners[1:200], p_places[1:200]) as k(o, p)
  where public.is_viewable_rating(k.o, k.p)
$$;
revoke execute on function public.rating_reactions(uuid[], uuid[]) from public, anon;
grant execute on function public.rating_reactions(uuid[], uuid[]) to authenticated;

-- 한 평가의 댓글 — 오래된 순, 차단한 사이 · 숨긴 댓글 제외
create function public.rating_comments_of(p_owner uuid, p_place uuid)
returns table (id uuid, author_id uuid, nickname text, body text, created_at timestamptz, mine boolean, can_delete boolean)
language sql stable security definer set search_path = '' as $$
  select c.id, c.author_id, pr.nickname, c.body, c.created_at,
         c.author_id = (select auth.uid()),
         c.author_id = (select auth.uid()) or c.owner_id = (select auth.uid())
  from public.rating_comments c
  join public.profiles pr on pr.id = c.author_id
  where c.owner_id = p_owner and c.place_id = p_place
    and public.is_viewable_rating(p_owner, p_place)
    and c.author_id not in (select public.my_block_ids())
    and not public.is_comment_hidden(c.id)
  order by c.created_at
  limit 300
$$;
revoke execute on function public.rating_comments_of(uuid, uuid) from public, anon;
grant execute on function public.rating_comments_of(uuid, uuid) to authenticated;

-- 평가 하나 — 댓글 화면 머리 (profile_ratings 와 같은 칸 + 주인 닉네임)
create function public.rating_detail(p_owner uuid, p_place uuid)
returns table (
  owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text,
  tier public.tier, review text, media jsonb, updated_at timestamptz, companions jsonb, menus text[]
)
language sql stable security definer set search_path = '' as $$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at,
         public.visit_companions(up.user_id, pl.id, false),
         up.menus
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  join public.profiles pr on pr.id = up.user_id
  where up.user_id = p_owner and up.place_id = p_place
    and public.is_viewable_rating(p_owner, p_place)
$$;
revoke execute on function public.rating_detail(uuid, uuid) from public, anon;
grant execute on function public.rating_detail(uuid, uuid) to authenticated;

-- 대표 사진 — 다른 사람 사진은 좋아요 많은 순, 같으면 최근 것 (19-2 약속)
create or replace function public.place_covers(p_places uuid[])
returns table (place_id uuid, path text, owner_id uuid, owner_nickname text, mine boolean)
language sql stable security definer set search_path = '' as $$
  with c as (
    select m.place_id, m.path, m.user_id, pr.nickname, m.created_at,
           case
             when m.user_id = (select auth.uid()) then 0
             when exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = m.user_id) then 1
             else 2
           end as rank
    from public.rating_media m
    join public.profiles pr on pr.id = m.user_id
    join public.user_places up on up.user_id = m.user_id and up.place_id = m.place_id
    where m.place_id = any (p_places[1:300])
      and m.kind = 'image'
      and (not up.sponsored or m.user_id = (select auth.uid()))
      and public.can_view_rating(m.user_id, m.place_id)
  )
  select distinct on (c.place_id) c.place_id, c.path, c.user_id, c.nickname, c.rank = 0
  from c
  where c.rank < 2
     or not exists (select 1 from public.reports r
                    where r.target_user = c.user_id and r.target_place = c.place_id and r.target_comment is null)
  order by c.place_id, c.rank,
           case when c.rank = 2 then (select count(*) from public.rating_likes l where l.owner_id = c.user_id and l.place_id = c.place_id) else 0 end desc,
           c.created_at desc
$$;
