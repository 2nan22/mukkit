-- 웹 푸시 구독 — 기기(브라우저)마다 한 줄. 본인만 넣고 지우고 읽는다. 발송은 서버(서비스 키)만
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) < 1000),
  p256dh text not null check (char_length(p256dh) < 200),
  auth text not null check (char_length(auth) < 100),
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "구독은 본인 것만 봄" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy "구독은 본인 것만 넣음" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy "구독은 본인 것만 지움" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));
