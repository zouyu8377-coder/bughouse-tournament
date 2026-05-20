export type PlayerId = string;
export type MatchId = string;
export type RoundId = string;

export interface Player {
  id: PlayerId;
  name: string;
  rating: number;
  seed: number;
  score: number;
  buchholz: number;
  progressive: number;
  sonnebornBerger: number;
}

export type Color = 'white' | 'black';

export interface TeamMember {
  playerId: PlayerId;
  color: Color;
}

export interface Team {
  id: string;
  members: TeamMember[];
}

export interface Board {
  boardNumber: number;
  whitePlayerId: PlayerId;
  blackPlayerId: PlayerId;
}

export interface Match {
  id: MatchId;
  teamA: Team;
  teamB: Team;
  boards?: [Board, Board];
  result?: MatchResult;
}

export type MatchResult = {
  teamAScore: number;
  teamBScore: number;
};

export type PairingStrategy = 'manual' | 'semiAuto' | 'auto';

export interface Round {
  id: RoundId;
  roundNumber: number;
  matches: Match[];
  locked: boolean;
  strategy: PairingStrategy;
}

export interface Tournament {
  id: string;
  name: string;
  players: Player[];
  rounds: Round[];
  currentRound: number;
  totalRounds: number;
  pairingStrategy: PairingStrategy;
}

export interface PlayerHistory {
  teammates: Set<PlayerId>;
  opponents: Set<PlayerId>;
  lastColor?: Color;
}

export type HistoryMap = Map<PlayerId, PlayerHistory>;

export interface PairingInput {
  players: Player[];
  history: HistoryMap;
  roundNumber: number;
  previousRounds: Round[];
}

export interface PairingOutput {
  matches: Match[];
  warnings: string[];
}

export interface DragItem {
  type: 'player' | 'team';
  data: PlayerId | Team;
}
