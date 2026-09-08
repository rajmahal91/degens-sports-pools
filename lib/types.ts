export type Sport = 'NFL' | 'NHL' | 'NBA';
export type ContestType = 'SURVIVOR' | 'PICKEM' | 'BRACKET' | 'PLAYOFF_FANTASY';
export type Position = 'QB' | 'RB' | 'WR' | 'TE';
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED';
export type PaymentMethod = 'ETRANSFER' | 'CASH' | 'CARD';
export type EntryStatus = 'ACTIVE' | 'ELIMINATED' | 'COMPLETE';
export type UserRole = 'PLAYER' | 'COMMISSIONER';

export interface Pool {
  id: string;
  name: string;
  sport: Sport;
  type: ContestType;
  status: 'OPEN' | 'ACTIVE' | 'COMPLETE';
  season: string;
  entryFeeCents: number;
  registrationClosesAt?: string;
}

export interface Entry {
  id: string;
  poolId: string;
  userId: string;
  entryName: string;
  status: EntryStatus;
  paymentStatus: PaymentStatus;
  rank?: number;
  score?: number;
}

export interface FantasySlot {
  position: Position;
  label: string;
  player?: string;
  locked?: boolean;
  points?: number;
}

export interface PaymentRecord {
  id: string;
  poolId: string;
  poolName: string;
  entryId?: string;
  entryName?: string;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  createdAt: string;
}

export interface SurvivorPick {
  entryId: string;
  week: number;
  teamCode: string;
  teamName: string;
  locked: boolean;
  result?: 'WIN' | 'LOSS' | 'PENDING';
}

export interface NFLGame {
  id: string;
  week: number;
  away: string;
  awayCode: string;
  home: string;
  homeCode: string;
  kickoff: string;
  status: 'SCHEDULED' | 'LIVE' | 'FINAL';
  awayScore?: number;
  homeScore?: number;
}

export interface PickemSelection {
  entryId: string;
  gameId: string;
  teamCode: string;
}
