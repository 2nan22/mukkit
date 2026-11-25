-- 70-3 피드 '여기까지 새 평가' 구분선 — 피드를 연 때를 계정에 기억한다
-- feed_open_at: 마지막으로 연 때 · feed_visit_at: 이번 방문을 시작한 때 · feed_seen_at: 이번에 구분선 기준(그 전 방문에서 마지막으로 연 때)
-- 공개 칸이 아니다 — profiles 는 칸 단위 읽기 권한이라 새 칸은 남이 못 읽음(20261203120000)
alter table public.profiles add column feed_open_at timestamptz, add column feed_visit_at timestamptz, add column feed_seen_at timestamptz;

-- 피드를 열 때 부른다. 30분 넘게 안 열었거나 방문이 2시간을 넘으면 새 방문 — 기준을 지난번 연 때로 옮김
-- 같은 방문 안의 새로 고침(댓글 · 차단)은 기준을 그대로 둬 구분선이 사라지지 않게 · 2시간 상한은 자주 여는 사람의 기준이 아침에 멈추지 않게
create function public.open_feed()
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_open timestamptz;
  v_visit timestamptz;
  v_seen timestamptz;
begin
  select feed_open_at, feed_visit_at, feed_seen_at into v_open, v_visit, v_seen from public.profiles where id = (select auth.uid());
  if v_open is null or now() - v_open > interval '30 minutes' or v_visit is null or now() - v_visit > interval '2 hours' then
    v_seen := v_open;
    v_visit := now();
  end if;
  update public.profiles set feed_open_at = now(), feed_visit_at = v_visit, feed_seen_at = v_seen where id = (select auth.uid());
  return v_seen;
end
$$;
revoke all on function public.open_feed() from public, anon;
grant execute on function public.open_feed() to authenticated;
