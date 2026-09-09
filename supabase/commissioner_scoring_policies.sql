-- Commissioners may synchronize shared NFL results and grade picks only for leagues they manage.
drop policy if exists "games commissioner update" on public.games;
create policy "games commissioner update" on public.games
for update to authenticated
using (exists (
  select 1 from public.pools p
  where p.sport = games.sport and p.season = games.season
    and (select private.can_manage_pool(p.id))
))
with check (exists (
  select 1 from public.pools p
  where p.sport = games.sport and p.season = games.season
    and (select private.can_manage_pool(p.id))
));

drop policy if exists "pickem commissioner update" on public.pickem_picks;
create policy "pickem commissioner update" on public.pickem_picks
for update to authenticated
using (exists (select 1 from public.entries e where e.id = pickem_picks.entry_id and (select private.can_manage_pool(e.pool_id))))
with check (exists (select 1 from public.entries e where e.id = pickem_picks.entry_id and (select private.can_manage_pool(e.pool_id))));

drop policy if exists "survivor commissioner update" on public.survivor_picks;
create policy "survivor commissioner update" on public.survivor_picks
for update to authenticated
using (exists (select 1 from public.entries e where e.id = survivor_picks.entry_id and (select private.can_manage_pool(e.pool_id))))
with check (exists (select 1 from public.entries e where e.id = survivor_picks.entry_id and (select private.can_manage_pool(e.pool_id))));
