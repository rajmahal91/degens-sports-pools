import type { ProviderAthlete, ProviderNFLGame, ProviderPlayerGame } from './types';

export interface NFLProvider {
  name: string;
  gamesByWeek(season: string, week: number, seasonType?: 'REG' | 'POST'): Promise<ProviderNFLGame[]>;
  players(): Promise<ProviderAthlete[]>;
  playerStatsByWeek(season: string, week: number, seasonType?: 'REG' | 'POST'): Promise<ProviderPlayerGame[]>;
}

function normalizeStatus(status?: string, isOver?: boolean): ProviderNFLGame['status'] {
  if (isOver || status?.toLowerCase().includes('final')) return 'FINAL';
  if (status?.toLowerCase().includes('progress') || status?.toLowerCase().includes('live')) return 'LIVE';
  if (status?.toLowerCase().includes('cancel')) return 'CANCELLED';
  return 'SCHEDULED';
}

class SportsDataIOProvider implements NFLProvider {
  name = 'sportsdataio';
  private key = process.env.SPORTSDATAIO_API_KEY || '';
  private base = process.env.SPORTSDATAIO_BASE_URL || 'https://api.sportsdata.io/v3/nfl';
  constructor() { if (!this.key) throw new Error('SPORTSDATAIO_API_KEY is missing.'); }
  private async get(path: string) {
    const res = await fetch(`${this.base}${path}`, { headers: { 'Ocp-Apim-Subscription-Key': this.key }, cache: 'no-store' });
    if (!res.ok) throw new Error(`SportsDataIO ${res.status}: ${await res.text()}`);
    return res.json();
  }
  async gamesByWeek(season: string, week: number, seasonType: 'REG' | 'POST' = 'REG') {
    const seasonParam = seasonType === 'POST' ? `${season}POST` : season;
    const rows = await this.get(`/scores/json/ScoresByWeek/${seasonParam}/${week}`);
    return (rows as any[]).map(g => ({
      id: String(g.GameKey || g.ScoreID || g.GameID), season, week: Number(g.Week ?? week), seasonType,
      awayTeamCode: String(g.AwayTeam), homeTeamCode: String(g.HomeTeam), startsAt: new Date(g.DateTime || g.Date).toISOString(),
      status: normalizeStatus(g.Status, g.IsOver), awayScore: g.AwayScore ?? null, homeScore: g.HomeScore ?? null,
    }));
  }
  async players() {
    const path = process.env.SPORTSDATAIO_PLAYERS_PATH || '/scores/json/Players';
    const rows = await this.get(path);
    return (rows as any[]).map(p => ({
      athleteId: String(p.PlayerID),
      fullName: String(p.Name || `${p.FirstName ?? ''} ${p.LastName ?? ''}`.trim()),
      teamCode: String(p.Team || ''), position: String(p.Position || ''), active: p.Active !== false && !!p.Team,
    })).filter(p => p.athleteId && p.fullName && ['QB','RB','WR','TE'].includes(p.position));
  }
  async playerStatsByWeek(season: string, week: number, seasonType: 'REG' | 'POST' = 'REG') {
    const seasonParam = seasonType === 'POST' ? `${season}POST` : season;
    const rows = await this.get(`/stats/json/PlayerGameStatsByWeek/${seasonParam}/${week}`);
    return (rows as any[]).map(p => ({
      athleteId: String(p.PlayerID), fullName: String(p.Name || `${p.FirstName ?? ''} ${p.LastName ?? ''}`.trim()),
      teamCode: String(p.Team || ''), position: String(p.Position || ''), gameId: String(p.GameKey || p.ScoreID || ''),
      passingYards: Number(p.PassingYards || 0), passingTouchdowns: Number(p.PassingTouchdowns || 0),
      interceptions: Number(p.PassingInterceptions || 0), rushingYards: Number(p.RushingYards || 0),
      rushingTouchdowns: Number(p.RushingTouchdowns || 0), receptions: Number(p.Receptions || 0),
      receivingYards: Number(p.ReceivingYards || 0), receivingTouchdowns: Number(p.ReceivingTouchdowns || 0),
      fumblesLost: Number(p.FumblesLost || 0),
      twoPointConversions: Number((p.TwoPointConversionPasses || 0)+(p.TwoPointConversionRuns || 0)+(p.TwoPointConversionReceptions || 0)),
    }));
  }
}

class DemoProvider implements NFLProvider {
  name = 'demo';
  async gamesByWeek(season:string, week:number, seasonType:'REG'|'POST'='REG') {
    return [{ id:`demo-${season}-${seasonType}-${week}-BUF-NYJ`, season, week, seasonType, awayTeamCode:'BUF', homeTeamCode:'NYJ', startsAt:new Date(Date.now()+86400000).toISOString(), status:'SCHEDULED' as const, awayScore:null, homeScore:null }];
  }
  async players() { return [
    ['1','Josh Allen','BUF','QB'],['2','James Cook','BUF','RB'],['3','Khalil Shakir','BUF','WR'],['4','Dalton Kincaid','BUF','TE'],
    ['5','Lamar Jackson','BAL','QB'],['6','Derrick Henry','BAL','RB'],['7','Zay Flowers','BAL','WR'],['8','Mark Andrews','BAL','TE'],
  ].map(([athleteId,fullName,teamCode,position])=>({athleteId,fullName,teamCode,position,active:true})); }
  async playerStatsByWeek() { return []; }
}

class ESPNProvider implements NFLProvider {
  name='espn';
  async gamesByWeek(season:string,week:number,seasonType:'REG'|'POST'='REG'){
    const seasonTypeNumber=seasonType==='POST'?3:2;
    const url=`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${encodeURIComponent(season)}&seasontype=${seasonTypeNumber}&week=${week}`;
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`ESPN score sync failed (${response.status}).`);
    const payload=await response.json();
    return (payload.events||[]).map((event:any)=>{
      const competition=event.competitions?.[0];
      const home=competition?.competitors?.find((team:any)=>team.homeAway==='home');
      const away=competition?.competitors?.find((team:any)=>team.homeAway==='away');
      return {id:String(event.id),season,week,seasonType,awayTeamCode:String(away?.team?.abbreviation||''),homeTeamCode:String(home?.team?.abbreviation||''),startsAt:new Date(event.date).toISOString(),status:normalizeStatus(event.status?.type?.description,event.status?.type?.completed),awayScore:away?.score==null?null:Number(away.score),homeScore:home?.score==null?null:Number(home.score)};
    }).filter((game:any)=>game.id&&game.awayTeamCode&&game.homeTeamCode);
  }
  async players(){return [];}
  async playerStatsByWeek(){return [];}
}

export function getNFLProvider(): NFLProvider {
  const provider=(process.env.SPORTS_PROVIDER||'espn').toLowerCase();
  if(provider==='sportsdataio'&&process.env.SPORTSDATAIO_API_KEY)return new SportsDataIOProvider();
  if(provider==='demo')return new DemoProvider();
  return new ESPNProvider();
}
