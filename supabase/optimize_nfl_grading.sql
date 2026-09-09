-- Supporting indexes for automated NFL result grading at league scale.
create index if not exists pickem_picks_game_id_idx on public.pickem_picks (game_id);
create index if not exists survivor_picks_game_id_idx on public.survivor_picks (game_id);
create index if not exists games_sport_season_week_idx on public.games (sport, season, week);
