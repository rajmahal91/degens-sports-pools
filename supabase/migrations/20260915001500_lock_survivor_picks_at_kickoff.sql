create or replace function private.enforce_survivor_pick_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_new_game public.games%rowtype;
  v_old_game public.games%rowtype;
begin
  select * into v_new_game from public.games where id = new.game_id;
  if not found then
    raise exception 'Selected game not found.' using errcode = '23503';
  end if;

  if v_new_game.status::text <> 'SCHEDULED'
     or v_new_game.kickoff_at <= clock_timestamp() then
    raise exception 'This Survivor game is already locked.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and
     (old.game_id is distinct from new.game_id
      or old.team_code is distinct from new.team_code
      or old.week is distinct from new.week) then
    select * into v_old_game from public.games where id = old.game_id;
    if found and
       (v_old_game.status::text <> 'SCHEDULED'
        or v_old_game.kickoff_at <= clock_timestamp()) then
      raise exception 'The saved Survivor pick is locked because its game has started.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_survivor_pick_lock on public.survivor_picks;
create trigger enforce_survivor_pick_lock
before insert or update of game_id, team_code, week
on public.survivor_picks
for each row execute function private.enforce_survivor_pick_lock();
