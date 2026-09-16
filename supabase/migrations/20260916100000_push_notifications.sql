-- Opt-in web push subscriptions and duplicate-safe notification delivery history.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id) where disabled_at is null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default true,
  pick_reminders boolean not null default true,
  results_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  dedupe_key text not null unique,
  notification_type text not null,
  title text not null,
  body text not null,
  target_url text not null default '/',
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','EXPIRED')),
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_deliveries_user_idx on public.notification_deliveries(user_id,created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions" on public.push_subscriptions
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences
for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "users view own notification deliveries" on public.notification_deliveries;
create policy "users view own notification deliveries" on public.notification_deliveries
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.notification_deliveries from anon;
grant select on table public.notification_deliveries to authenticated;

