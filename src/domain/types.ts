// ==================== 基础类型 ====================

export type PlayerId = string;
export type MatchId = string;
export type RoundId = string;

export interface Player {
  id: PlayerId;
  name: string;
  rating: number; // 保留但不再用于配对逻辑
  seed: number; // 种子号，越小越高（1=最高种子）
  score: number; // 当前总积分
  buchholz: number; // 对手分总和
  progressive: number; // 累进分
  sonnebornBerger: number; // 索博分
}

export type Color = 'white' | 'black';

export interface TeamMember {
  playerId: PlayerId;
  color: Color; // 在台次上的颜色
}

export interface Team {
  id: string;
  members: TeamMember[]; // 自动配对时恰好2人，手动配对草稿可为空
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
  boards?: [Board, Board]; // 两张棋盘的真实对位
  result?: MatchResult; // undefined = 未录入
}

export type MatchResult = {
  teamAScore: number; // 0, 0.5, 1
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
  currentRound: number; // 从1开始
  totalRounds: number; // 比赛总轮次
}

// ==================== 历史记录（用于避免重复配对） ====================

export interface PlayerHistory {
  teammates: Set<PlayerId>; // 合作过的队友
  opponents: Set<PlayerId>; // 对战过的对手（个人层面）
  lastColor?: Color; // 上一轮执棋颜色
}

export type HistoryMap = Map<PlayerId, PlayerHistory>;

// ==================== 配对引擎输入输出 ====================

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

// ==================== UI 状态 ====================

export interface DragItem {
  type: 'player' | 'team';
  data: PlayerId | Team;
}
