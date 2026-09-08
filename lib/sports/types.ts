export type ProviderGameStatus = 'SCHEDULED' | 'LIVE' | 'FINAL' | 'CANCELLED';

export interface ProviderNFLGame {
  id: string; season: string; week: number; seasonType: 'REG' | 'POST';
  awayTeamCode: string; homeTeamCode: string; startsAt: string; status: ProviderGameStatus;
  awayScore?: number | null; homeScore?: number | null;
}

export interface ProviderAthlete {
  athleteId: string; fullName: string; teamCode: string; position: string; active: boolean;
}

export interface ProviderPlayerGame {
  athleteId: string; fullName: string; teamCode: string; position: string; gameId: string;
  passingYards: number; passingTouchdowns: number; interceptions: number;
  rushingYards: number; rushingTouchdowns: number; receptions: number;
  receivingYards: number; receivingTouchdowns: number; fumblesLost: number; twoPointConversions: number;
}
