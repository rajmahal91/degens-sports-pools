alter table public.pools
  drop constraint if exists pools_payment_free;

alter table public.pools
  add constraint pools_payment_free check (entry_fee_cents = 0);

revoke all on table public.payments from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;
