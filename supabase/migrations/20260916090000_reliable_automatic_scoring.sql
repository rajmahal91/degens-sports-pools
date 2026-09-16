-- Reliable NFL scoring: auditable runs and reversible automatic eliminations.

alter table public.entries
  add column if not exists elimination_week integer,
  add column if not exists elimination_reason text,
  add column if not exists eliminated_at timestamptz;

alter table public.entries
  drop constraint if exists entries_elimination_reason_check;

alter table public.entries
  add constraint entries_elimination_reason_check
  check (elimination_reason is null or elimination_reason in ('GAME_LOSS', 'MISSED_PICK'));

create table if not exists public.scoring_runs (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid references public.pools(id) on delete cascade,
  sport text not null,
  season integer not null,
  week integer not null,
  season_type text not null default 'REG' check (season_type in ('REG', 'POST')),
  trigger_source text not null check (trigger_source in ('cron', 'commissioner', 'admin')),
  status text not null default 'RUNNING' check (status in ('RUNNING', 'SUCCEEDED', 'FAILED')),
  provider text,
  details jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists scoring_runs_lookup_idx
  on public.scoring_runs (sport, season, week, started_at desc);

create index if not exists scoring_runs_pool_idx
  on public.scoring_runs (pool_id, started_at desc)
  where pool_id is not null;

create index if not exists entries_automatic_elimination_idx
  on public.entries (pool_id, elimination_week, elimination_reason)
  where elimination_reason is not null;

alter table public.scoring_runs enable row level security;

drop policy if exists "league managers view scoring runs" on public.scoring_runs;
create policy "league managers view scoring runs"
on public.scoring_runs
for select
to authenticated
using (
  (pool_id is not null and (select private.can_manage_pool(pool_id)))
  or
  (pool_id is null and exists (
    select 1
    from public.pools p
    where p.sport = scoring_runs.sport
      and p.season = scoring_runs.season
      and (select private.can_manage_pool(p.id))
  ))
);

revoke all on table public.scoring_runs from anon;
grant select on table public.scoring_runs to authenticated;

