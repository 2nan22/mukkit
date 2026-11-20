-- 평가 공개 범위 · 공개 한마디 · 사진 · 영상 · 팔로우 피드
create type public.rating_visibility as enum ('private', 'followers', 'public');

-- note 는 언제나 나만 보는 메모, review 는 공개 범위에 따라 남에게 보이는 한마디
alter table public.user_places
  add column visibility public.rating_visibility not null default 'private',
  add column review text not null default '' check (char_length(review) <= 200);

create table public.rating_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  place_id uuid not null,
  path text not null unique,
  kind text not null check (kind in ('image', 'video')),
  created_at timestamptz not null default now(),
  foreign key (user_id, place_id) references public.user_places (user_id, place_id) on delete cascade
);
create index rating_media_owner_idx on public.rating_media (user_id, place_id);

alter table public.rating_media enable row level security;
create policy "본인 미디어 읽기" on public.rating_media for select using ((select auth.uid()) = user_id);
create policy "본인 미디어 추가" on public.rating_media for insert with check ((select auth.uid()) = user_id);
create policy "본인 미디어 삭제" on public.rating_media for delete using ((select auth.uid()) = user_id);

-- 보는 사람이 이 평가를 볼 수 있나 — 공개, 또는 팔로워 공개이고 내가 팔로우 중
create function public.can_view_rating(p_owner uuid, p_place uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_places up
    where up.user_id = p_owner and up.place_id = p_place
      and (
        up.user_id = (select auth.uid())
        or up.visibility = 'public'
        or (up.visibility = 'followers' and exists (
          select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = p_owner))
      )
  )
$$;

-- 사진 · 영상 버킷 — 경로 '<사용자>/<장소>/<파일>'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rating-media', 'rating-media', false, 30 * 1024 * 1024,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create policy "미디어 올리기는 내 폴더에만" on storage.objects for insert to authenticated
  with check (bucket_id = 'rating-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "미디어 지우기는 내 것만" on storage.objects for delete to authenticated
  using (bucket_id = 'rating-media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "미디어 보기는 평가를 볼 수 있을 때만" on storage.objects for select
  using (
    bucket_id = 'rating-media'
    and public.can_view_rating(((storage.foldername(name))[1])::uuid, ((storage.foldername(name))[2])::uuid)
  );

-- 팔로우한 사람의 볼 수 있는 평가 — 메모(note) 는 절대 싣지 않는다
create function public.feed(p_before timestamptz default null, p_limit int default 20)
returns table (
  owner_id uuid, owner_nickname text, place_id uuid, place_name text, address text, cuisine text,
  tier public.tier, review text, media jsonb, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select up.user_id, pr.nickname, pl.id, pl.name, pl.address, pl.cuisine,
         up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at
  from public.follows f
  join public.user_places up on up.user_id = f.followee_id
  join public.profiles pr on pr.id = up.user_id
  join public.places pl on pl.id = up.place_id
  where f.follower_id = (select auth.uid())
    and up.visibility in ('public', 'followers')
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and (p_before is null or up.updated_at < p_before)
  order by up.updated_at desc
  limit least(p_limit, 50)
$$;

-- 한 사람의 공개 평가 — 프로필 화면용 (팔로워 공개는 팔로우 중일 때만)
create function public.profile_ratings(p_owner uuid, p_limit int default 60)
returns table (
  place_id uuid, place_name text, address text, cuisine text, tier public.tier, review text, media jsonb, updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select pl.id, pl.name, pl.address, pl.cuisine, up.tier, up.review,
         coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'kind', m.kind) order by m.created_at)
                   from public.rating_media m where m.user_id = up.user_id and m.place_id = up.place_id), '[]'::jsonb),
         up.updated_at
  from public.user_places up
  join public.places pl on pl.id = up.place_id
  where up.user_id = p_owner
    and up.tier in ('three', 'two', 'one', 'not_recommended')
    and public.can_view_rating(up.user_id, up.place_id)
  order by up.updated_at desc
  limit least(p_limit, 200)
$$;

revoke all on function public.can_view_rating(uuid, uuid) from public;
revoke all on function public.feed(timestamptz, int) from public;
revoke all on function public.profile_ratings(uuid, int) from public;
grant execute on function public.can_view_rating(uuid, uuid) to anon, authenticated;
grant execute on function public.feed(timestamptz, int) to authenticated;
grant execute on function public.profile_ratings(uuid, int) to anon, authenticated;
