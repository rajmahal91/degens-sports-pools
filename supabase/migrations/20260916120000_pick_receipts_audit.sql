-- Immutable player pick receipts and commissioner audit history.

create table if not exists public.pick_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  pool_id uuid not null references public.pools(id) on delete cascade,
  pick_type text not null check (pick_type in ('SURVIVOR','PICKEM','PLAYOFF_FANTASY')),
  pick_key text not null,
  action text not null check (action in ('SUBMITTED','CHANGED')),
  before_state jsonb,
  after_state jsonb not null,
  submitted_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  source text not null default 'PLAYER' check (source in ('PLAYER','COMMISSIONER','SYSTEM'))
);

create index if not exists pick_receipts_entry_recorded_idx
  on public.pick_receipts(entry_id, recorded_at desc);

create index if not exists pick_receipts_pool_recorded_idx
  on public.pick_receipts(pool_id, recorded_at desc);

alter table public.pick_receipts enable row level security;

drop policy if exists "Users view own pick receipts" on public.pick_receipts;
create policy "Users view own pick receipts"
  on public.pick_receipts
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.pick_receipts from anon;
revoke insert, update, delete on table public.pick_receipts from authenticated;
grant select on table public.pick_receipts to authenticated;
