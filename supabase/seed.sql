-- Optional starter pools. Run after schema.sql and edit fees/settings as desired.
insert into pools (id,name,sport,contest_type,season,status,entry_fee_cents,currency,max_entries_per_user,settings)
values
('00000000-0000-0000-0000-000000000101','NFL Degens Survivor','NFL','SURVIVOR','2026','ACTIVE',10000,'CAD',3,'{"pick_deadline":"game_kickoff"}'),
('00000000-0000-0000-0000-000000000102','NFL Degens Pick’em','NFL','PICKEM','2026','ACTIVE',0,'CAD',1,'{}'),
('00000000-0000-0000-0000-000000000103','NFL Playoff Fantasy','NFL','PLAYOFF_FANTASY','2026','OPEN',5000,'CAD',3,'{"scoring":{"passingYardsPerPoint":25,"passingTd":4,"interception":-2,"rushingYardsPerPoint":10,"rushingTd":6,"receivingYardsPerPoint":10,"receivingTd":6,"reception":0.5,"fumbleLost":-2,"twoPointConversion":2}}')
on conflict (id) do nothing;

insert into rounds(pool_id,name,sequence)
select id,'Week '||g, g from pools cross join generate_series(1,18) g where id='00000000-0000-0000-0000-000000000101' on conflict do nothing;
insert into rounds(pool_id,name,sequence)
select id,'Week '||g, g from pools cross join generate_series(1,18) g where id='00000000-0000-0000-0000-000000000102' on conflict do nothing;
insert into rounds(pool_id,name,sequence) values
('00000000-0000-0000-0000-000000000103','Wild Card',1),
('00000000-0000-0000-0000-000000000103','Divisional',2),
('00000000-0000-0000-0000-000000000103','Conference Championships',3),
('00000000-0000-0000-0000-000000000103','Super Bowl',4)
on conflict do nothing;
