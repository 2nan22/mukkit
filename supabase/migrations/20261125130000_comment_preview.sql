-- 인스타그램식 댓글 (24) — 카드 아래 최근 댓글 2개 미리보기를 좋아요 · 댓글 수와 함께
drop function public.rating_reactions(uuid[], uuid[]);
create function public.rating_reactions(p_owners uuid[], p_places uuid[])
returns table (owner_id uuid, place_id uuid, likes int, liked boolean, comments int, preview jsonb)
language sql stable security definer set search_path = '' as $$
  with k as (
    select o, p from unnest(p_owners[1:200], p_places[1:200]) as k(o, p)
    where public.is_viewable_rating(o, p)
  ),
  c as (
    select cm.*, pr.nickname
    from k
    join public.rating_comments cm on cm.owner_id = k.o and cm.place_id = k.p
    join public.profiles pr on pr.id = cm.author_id
    where cm.author_id not in (select public.my_block_ids())
      and not public.is_comment_hidden(cm.id)
  )
  select k.o, k.p,
         (select count(*)::int from public.rating_likes l where l.owner_id = k.o and l.place_id = k.p),
         exists (select 1 from public.rating_likes l where l.owner_id = k.o and l.place_id = k.p and l.user_id = (select auth.uid())),
         (select count(*)::int from c where c.owner_id = k.o and c.place_id = k.p),
         -- 최근 2개를 오래된 순으로
         coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'authorId', x.author_id, 'nickname', x.nickname, 'body', x.body) order by x.created_at)
                   from (select * from c where c.owner_id = k.o and c.place_id = k.p order by c.created_at desc limit 2) x), '[]'::jsonb)
  from k
$$;
revoke execute on function public.rating_reactions(uuid[], uuid[]) from public, anon;
grant execute on function public.rating_reactions(uuid[], uuid[]) to authenticated;
