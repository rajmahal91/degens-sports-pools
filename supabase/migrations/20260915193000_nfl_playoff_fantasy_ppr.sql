-- NFL Playoff Fantasy: four playoff rounds and standard full-PPR scoring.
-- Games are linked to rounds by round_order (1=Wild Card ... 4=Super Bowl)
-- and round_label when the NFL schedule is synced.

insert into public.rounds (pool_id, label, round_order)
select p.id, r.label, r.round_order
from public.pools p
cross join (values
  ('Wild Card', 1),
  ('Divisional', 2),
  ('Conference Championship', 3),
  ('Super Bowl', 4)
) as r(label, round_order)
where p.pool_type = 'PLAYOFF_FANTASY'
on conflict do nothing;

update public.pools
set scoring_settings = jsonb_build_object(
  'pass_yards_per_point', 25,
  'pass_td', 4,
  'interception', -2,
  'rush_yards_per_point', 10,
  'rush_td', 6,
  'rec_yards_per_point', 10,
  'rec_td', 6,
  'reception', 1,
  'fumble_lost', -2,
  'two_point', 2,
  'format', 'FULL_PPR'
)
where pool_type = 'PLAYOFF_FANTASY';
