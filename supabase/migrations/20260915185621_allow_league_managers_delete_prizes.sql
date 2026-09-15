drop policy if exists "prizes creator delete" on public.prizes;
drop policy if exists "prizes managers delete" on public.prizes;

create policy "prizes managers delete"
on public.prizes
for delete
to authenticated
using ((select private.can_manage_pool(prizes.pool_id)));
