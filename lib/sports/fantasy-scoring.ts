import type { ProviderPlayerGame } from './types';

export type FantasyScoring = {
  pass_yards_per_point: number;
  pass_td: number;
  interception: number;
  rush_yards_per_point: number;
  rush_td: number;
  rec_yards_per_point: number;
  rec_td: number;
  reception: number;
  fumble_lost: number;
  two_point: number;
};

export const FULL_PPR_SCORING: FantasyScoring = {
  pass_yards_per_point: 25,
  pass_td: 4,
  interception: -2,
  rush_yards_per_point: 10,
  rush_td: 6,
  rec_yards_per_point: 10,
  rec_td: 6,
  reception: 1,
  fumble_lost: -2,
  two_point: 2,
};

export function normalizeFantasyScoring(value: unknown): FantasyScoring {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(FULL_PPR_SCORING).map(([key, fallback]) => [
      key,
      Number.isFinite(Number(input[key])) ? Number(input[key]) : fallback,
    ]),
  ) as FantasyScoring;
}

export function calculateFullPprPoints(stat: ProviderPlayerGame, settings?: unknown) {
  const s = normalizeFantasyScoring(settings);
  return Number((
    stat.passingYards / s.pass_yards_per_point +
    stat.passingTouchdowns * s.pass_td +
    stat.interceptions * s.interception +
    stat.rushingYards / s.rush_yards_per_point +
    stat.rushingTouchdowns * s.rush_td +
    stat.receptions * s.reception +
    stat.receivingYards / s.rec_yards_per_point +
    stat.receivingTouchdowns * s.rec_td +
    stat.fumblesLost * s.fumble_lost +
    stat.twoPointConversions * s.two_point
  ).toFixed(2));
}
