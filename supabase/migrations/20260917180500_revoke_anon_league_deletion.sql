revoke execute on function public.delete_league(uuid) from anon;
revoke execute on function public.delete_league(uuid) from public;
grant execute on function public.delete_league(uuid) to authenticated;
