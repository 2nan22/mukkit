-- 새벽 원본 새로 고침 대상 조건 보완 (65)
-- 1) 20시간 안에 읽은 리스트 제외 → 6시간: 전날 저녁에 가져온 리스트도 다음 새벽에 읽힌다 (크론은 하루 한 번)
-- 2) 최근 30일 사용 판단: last_sign_in_at 은 자동 로그인(토큰 갱신)으로는 안 바뀐다 → 세션 갱신 시각도 본다
create or replace function public.import_sources_due(p_limit int)
returns table (user_id uuid, source text, source_list_id text, mode text, tier public.tier)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.source, s.source_list_id, s.mode, s.tier
  from public.import_sources s
  join auth.users u on u.id = s.user_id
  where (
      u.last_sign_in_at > now() - interval '30 days'
      or exists (select 1 from auth.sessions a where a.user_id = s.user_id and a.updated_at > now() - interval '30 days')
    )
    and s.fail_count < 5
    and (s.last_synced_at is null or s.last_synced_at < now() - interval '6 hours')
    and (s.status <> 'unavailable' or s.last_synced_at < now() - interval '7 days')
  order by s.last_synced_at nulls first
  limit least(p_limit, 500)
$$;
revoke execute on function public.import_sources_due(int) from public, anon, authenticated;
