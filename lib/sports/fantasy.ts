import type { ProviderPlayerGame } from './types';

export interface FantasyScoring {
  passingYardsPerPoint: number;
  passingTd: number;
  interception: number;
  rushingYardsPerPoint: number;
  rushingTd: number;
  receivingYardsPerPoint: number;
  receivingTd: number;
  reception: number;
  fumbleLost: number;
  twoPointConversion: number;
}

export const DEFAULT_HALF_PPR: FantasyScoring = {
  passingYardsPerPoint: 25,
  passingTd: 4,
  interception: -2,
  rushingYardsPerPoint: 10,
  rushingTd: 6,
  receivingYardsPerPoint: 10,
  receivingTd: 6,
  reception: 0.5,
  fumbleLost: -2,
  twoPointConversion: 2,
};

export function calculateFantasyPoints(s: ProviderPlayerGame, cfg: FantasyScoring = DEFAULT_HALF_PPR) {
  const total =
    s.passingYards / cfg.passingYardsPerPoint +
    s.passingTouchdowns * cfg.passingTd +
    s.interceptions * cfg.interception +
    s.rushingYards / cfg.rushingYardsPerPoint +
    s.rushingTouchdowns * cfg.rushingTd +
    s.receivingYards / cfg.receivingYardsPerPoint +
    s.receivingTouchdowns * cfg.receivingTd +
    s.receptions * cfg.reception +
    s.fumblesLost * cfg.fumbleLost +
    s.twoPointConversions * cfg.twoPointConversion;
  return Math.round(total * 100) / 100;
}
