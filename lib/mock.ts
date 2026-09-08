import { Entry, NFLGame, PaymentRecord, Pool, SurvivorPick } from './types';

export const pools: Pool[] = [
  { id: 'nfl-survivor', name: 'NFL Degens Survivor', sport: 'NFL', type: 'SURVIVOR', status: 'ACTIVE', season: '2026', entryFeeCents: 10000, registrationClosesAt: '2026-09-07T23:59:00-07:00' },
  { id: 'nfl-pickem', name: 'NFL Degens Pick’em', sport: 'NFL', type: 'PICKEM', status: 'ACTIVE', season: '2026', entryFeeCents: 0 },
  { id: 'nfl-playoff-fantasy', name: 'NFL Playoff Fantasy', sport: 'NFL', type: 'PLAYOFF_FANTASY', status: 'OPEN', season: '2026-27', entryFeeCents: 5000 },
  { id: 'nhl-bracket', name: 'NHL Playoff Bracket', sport: 'NHL', type: 'BRACKET', status: 'OPEN', season: '2026-27', entryFeeCents: 5000 },
  { id: 'nba-bracket', name: 'NBA Playoff Bracket', sport: 'NBA', type: 'BRACKET', status: 'OPEN', season: '2026-27', entryFeeCents: 5000 },
];

export const entries: Entry[] = [
  { id: 'entry-r91', poolId: 'nfl-survivor', userId: 'raj', entryName: 'Rouge91', status: 'ACTIVE', paymentStatus: 'PAID', rank: 18 },
  { id: 'entry-r91-2', poolId: 'nfl-survivor', userId: 'raj', entryName: 'Rouge91 #2', status: 'ACTIVE', paymentStatus: 'PAID', rank: 44 },
  { id: 'entry-pickem', poolId: 'nfl-pickem', userId: 'raj', entryName: 'Rouge91', status: 'ACTIVE', paymentStatus: 'PAID', rank: 7, score: 0 },
  { id: 'entry-fantasy', poolId: 'nfl-playoff-fantasy', userId: 'raj', entryName: 'Rouge91', status: 'ACTIVE', paymentStatus: 'UNPAID' },
  { id: 'entry-nhl', poolId: 'nhl-bracket', userId: 'raj', entryName: 'Rouge91', status: 'ACTIVE', paymentStatus: 'UNPAID' },
];

export const demoPayments: PaymentRecord[] = [
  { id: 'pay-1', poolId: 'nfl-survivor', poolName: 'NFL Degens Survivor', entryId: 'entry-r91', entryName: 'Rouge91', amountCents: 10000, method: 'ETRANSFER', status: 'PAID', reference: 'AUTO-2026', createdAt: '2026-09-07T18:30:00-07:00' },
  { id: 'pay-2', poolId: 'nfl-survivor', poolName: 'NFL Degens Survivor', entryId: 'entry-r91-2', entryName: 'Rouge91 #2', amountCents: 10000, method: 'ETRANSFER', status: 'PAID', reference: 'AUTO-2026-B', createdAt: '2026-09-07T18:31:00-07:00' },
];

export const nflTeams = [
  ['ARI','Arizona Cardinals'],['ATL','Atlanta Falcons'],['BAL','Baltimore Ravens'],['BUF','Buffalo Bills'],['CAR','Carolina Panthers'],['CHI','Chicago Bears'],['CIN','Cincinnati Bengals'],['CLE','Cleveland Browns'],
  ['DAL','Dallas Cowboys'],['DEN','Denver Broncos'],['DET','Detroit Lions'],['GB','Green Bay Packers'],['HOU','Houston Texans'],['IND','Indianapolis Colts'],['JAX','Jacksonville Jaguars'],['KC','Kansas City Chiefs'],
  ['LV','Las Vegas Raiders'],['LAC','Los Angeles Chargers'],['LA','Los Angeles Rams'],['MIA','Miami Dolphins'],['MIN','Minnesota Vikings'],['NE','New England Patriots'],['NO','New Orleans Saints'],['NYG','New York Giants'],
  ['NYJ','New York Jets'],['PHI','Philadelphia Eagles'],['PIT','Pittsburgh Steelers'],['SF','San Francisco 49ers'],['SEA','Seattle Seahawks'],['TB','Tampa Bay Buccaneers'],['TEN','Tennessee Titans'],['WAS','Washington Commanders'],
] as const;

export const week1Games: NFLGame[] = [
  { id:'ne-sea', week:1, away:'New England Patriots', awayCode:'NE', home:'Seattle Seahawks', homeCode:'SEA', kickoff:'2026-09-09T17:20:00-07:00', status:'SCHEDULED' },
  { id:'sf-la', week:1, away:'San Francisco 49ers', awayCode:'SF', home:'Los Angeles Rams', homeCode:'LA', kickoff:'2026-09-10T17:35:00-07:00', status:'SCHEDULED' },
  { id:'chi-car', week:1, away:'Chicago Bears', awayCode:'CHI', home:'Carolina Panthers', homeCode:'CAR', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'bal-ind', week:1, away:'Baltimore Ravens', awayCode:'BAL', home:'Indianapolis Colts', homeCode:'IND', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'atl-pit', week:1, away:'Atlanta Falcons', awayCode:'ATL', home:'Pittsburgh Steelers', homeCode:'PIT', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'cle-jax', week:1, away:'Cleveland Browns', awayCode:'CLE', home:'Jacksonville Jaguars', homeCode:'JAX', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'tb-cin', week:1, away:'Tampa Bay Buccaneers', awayCode:'TB', home:'Cincinnati Bengals', homeCode:'CIN', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'nyj-ten', week:1, away:'New York Jets', awayCode:'NYJ', home:'Tennessee Titans', homeCode:'TEN', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'no-det', week:1, away:'New Orleans Saints', awayCode:'NO', home:'Detroit Lions', homeCode:'DET', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'buf-hou', week:1, away:'Buffalo Bills', awayCode:'BUF', home:'Houston Texans', homeCode:'HOU', kickoff:'2026-09-13T10:00:00-07:00', status:'SCHEDULED' },
  { id:'ari-lac', week:1, away:'Arizona Cardinals', awayCode:'ARI', home:'Los Angeles Chargers', homeCode:'LAC', kickoff:'2026-09-13T13:25:00-07:00', status:'SCHEDULED' },
  { id:'gb-min', week:1, away:'Green Bay Packers', awayCode:'GB', home:'Minnesota Vikings', homeCode:'MIN', kickoff:'2026-09-13T13:25:00-07:00', status:'SCHEDULED' },
  { id:'mia-lv', week:1, away:'Miami Dolphins', awayCode:'MIA', home:'Las Vegas Raiders', homeCode:'LV', kickoff:'2026-09-13T13:25:00-07:00', status:'SCHEDULED' },
  { id:'was-phi', week:1, away:'Washington Commanders', awayCode:'WAS', home:'Philadelphia Eagles', homeCode:'PHI', kickoff:'2026-09-13T13:25:00-07:00', status:'SCHEDULED' },
  { id:'dal-nyg', week:1, away:'Dallas Cowboys', awayCode:'DAL', home:'New York Giants', homeCode:'NYG', kickoff:'2026-09-13T17:20:00-07:00', status:'SCHEDULED' },
];

export const initialSurvivorPicks: SurvivorPick[] = [];

export const leaderboard = [
  { rank:1, name:'HMundi', score:0, alive:true },
  { rank:2, name:'Rouge91', score:0, alive:true },
  { rank:3, name:'SunnyS', score:0, alive:true },
  { rank:4, name:'TheJoker93', score:0, alive:true },
  { rank:5, name:'Mhunjan', score:0, alive:true },
];
