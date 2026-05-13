import type {
  Player,
  PlayerId,
  Team,
  Match,
  Round,
  HistoryMap,
  PlayerHistory,
  PairingInput,
  PairingOutput,
  PairingStrategy,
} from './types';

// ==================== 工具函数 ====================

const REPEAT_TEAMMATE_PENALTY = 100000;
const TEAM_SCORE_DIFF_WEIGHT = 2000;
const TEAM_SEED_DIFF_WEIGHT = 20;
const PERSONAL_SCORE_SPREAD_WEIGHT = 80;
const HIGH_LOW_TEAMMATE_WEIGHT = 10;
const REPEAT_OPPONENT_WEIGHT = 8;
const COLOR_REPEAT_WEIGHT = 5;
const RANDOM_NOISE_WEIGHT = 0.01;
const EXACT_SEARCH_PLAYER_LIMIT = 16;
const CANDIDATE_LIMIT = 80;
const NODE_LIMIT = 200000;

function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function emptyHistory(): PlayerHistory {
  return { teammates: new Set(), opponents: new Set() };
}

export function buildHistory(rounds: Round[]): HistoryMap {
  const map: HistoryMap = new Map();

  for (const round of rounds) {
    for (const match of round.matches) {
      const { teamA, teamB } = match;
      // 记录队友关系与颜色历史
      for (const team of [teamA, teamB]) {
        const [m1, m2] = team.members;
        const h1 = map.get(m1.playerId) ?? emptyHistory();
        const h2 = map.get(m2.playerId) ?? emptyHistory();
        h1.teammates.add(m2.playerId);
        h2.teammates.add(m1.playerId);
        // 记录上一轮颜色（遍历完所有轮次后自然保留最后一轮）
        h1.lastColor = m1.color;
        h2.lastColor = m2.color;
        map.set(m1.playerId, h1);
        map.set(m2.playerId, h2);
      }
      // 记录对手关系（个人层面）
      for (const mA of teamA.members) {
        for (const mB of teamB.members) {
          const hA = map.get(mA.playerId) ?? emptyHistory();
          const hB = map.get(mB.playerId) ?? emptyHistory();
          hA.opponents.add(mB.playerId);
          hB.opponents.add(mA.playerId);
          map.set(mA.playerId, hA);
          map.set(mB.playerId, hB);
        }
      }
    }
  }

  return map;
}

// ==================== 评分函数 ====================

function seededNoise(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000000) / 1000000;
}

/** 队友匹配成本（越低越好） */
function teammateCost(p1: Player, p2: Player, history: HistoryMap): number {
  const h1 = history.get(p1.id) ?? emptyHistory();
  const h2 = history.get(p2.id) ?? emptyHistory();

  const hasTeamed = h1.teammates.has(p2.id) || h2.teammates.has(p1.id);
  const teamedPenalty = hasTeamed ? REPEAT_TEAMMATE_PENALTY : 0;

  // 种子差距越大越好：高种子优先搭低种子。
  const seedDiff = Math.abs(p1.seed - p2.seed);
  const seedScore = (64 - seedDiff) * HIGH_LOW_TEAMMATE_WEIGHT;

  return teamedPenalty + seedScore;
}

function colorCostForTeam(p1: Player, p2: Player, history: HistoryMap): number {
  const h1 = history.get(p1.id);
  const h2 = history.get(p2.id);
  const whiteFirst =
    (h1?.lastColor === 'white' ? COLOR_REPEAT_WEIGHT : 0) +
    (h2?.lastColor === 'black' ? COLOR_REPEAT_WEIGHT : 0);
  const whiteSecond =
    (h2?.lastColor === 'white' ? COLOR_REPEAT_WEIGHT : 0) +
    (h1?.lastColor === 'black' ? COLOR_REPEAT_WEIGHT : 0);
  return Math.min(whiteFirst, whiteSecond);
}

/** 队伍对阵成本（越低越好） */
function matchCost(
  teamA: Team,
  teamB: Team,
  playersMap: Map<PlayerId, Player>,
  history: HistoryMap
): number {
  const statsA = teamStats(teamA, playersMap);
  const statsB = teamStats(teamB, playersMap);

  const scoreDiff = Math.abs(statsA.scoreSum - statsB.scoreSum);
  const seedDiff = Math.abs(statsA.seedSum - statsB.seedSum);
  const scoreSpread = Math.max(...statsA.scores, ...statsB.scores) - Math.min(...statsA.scores, ...statsB.scores);
  const repeatedOpponents = countRepeatedOpponents(teamA, teamB, history);

  return (
    scoreDiff * TEAM_SCORE_DIFF_WEIGHT +
    seedDiff * TEAM_SEED_DIFF_WEIGHT +
    scoreSpread * PERSONAL_SCORE_SPREAD_WEIGHT +
    repeatedOpponents * REPEAT_OPPONENT_WEIGHT
  );
}

function teamStats(team: Team, playersMap: Map<PlayerId, Player>): { scoreSum: number; seedSum: number; scores: number[] } {
  return team.members.reduce(
    (stats, m) => {
      const player = playersMap.get(m.playerId);
      return {
        scoreSum: stats.scoreSum + (player?.score ?? 0),
        seedSum: stats.seedSum + (player?.seed ?? 0),
        scores: [...stats.scores, player?.score ?? 0],
      };
    },
    { scoreSum: 0, seedSum: 0, scores: [] as number[] }
  );
}

function countRepeatedOpponents(teamA: Team, teamB: Team, history: HistoryMap): number {
  let count = 0;
  for (const a of teamA.members) {
    const hA = history.get(a.playerId);
    for (const b of teamB.members) {
      if (hA?.opponents.has(b.playerId)) count++;
    }
  }
  return count;
}

type MatchCandidate = {
  match: Match;
  cost: number;
  playerIds: PlayerId[];
};

// ==================== 核心配对算法 ====================

/**
 * 半自动配对（SemiAuto）
 * 策略：
 * 1. 按 score 分组
 * 2. 组内优先组队，必要时上下浮动
 * 3. 队伍间按总 rating 配对
 */
export function generateSemiAutoPairing(input: PairingInput): PairingOutput {
  const { players, history, roundNumber } = input;
  const warnings: string[] = [];

  if (players.length % 4 !== 0) {
    warnings.push(`当前人数 ${players.length} 不是4的倍数，部分玩家可能轮空`);
  }

  // 按 score 降序，同分按 seed 升序（高种子在前）
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.seed - b.seed;
  });

  const playersMap = new Map<PlayerId, Player>(players.map((p) => [p.id, p]));
  const playableCount = Math.floor(sortedPlayers.length / 4) * 4;
  const activePlayers = sortedPlayers.slice(0, playableCount);
  const leftoverPlayers = sortedPlayers.slice(playableCount);

  if (leftoverPlayers.length > 0) {
    warnings.push(`以下玩家本轮轮空：${leftoverPlayers.map((p) => p.name).join('、')}`);
  }

  const search = searchBestMatches(activePlayers, playersMap, history, roundNumber);
  if (!search.exact) {
    warnings.push('参赛人数较多，本轮使用候选集全局优化；如需严格全量最优，请减少人数或接入求解器');
  }
  if (search.hitNodeLimit) {
    warnings.push('全局搜索达到节点上限，已返回当前找到的最低成本方案');
  }

  const matches = search.matches.map((match, index) => ({
    ...match,
    id: `${input.roundNumber}-match-${index + 1}-${match.teamA.id}-${match.teamB.id}`,
  }));

  return { matches, warnings };
}

function searchBestMatches(
  players: Player[],
  playersMap: Map<PlayerId, Player>,
  history: HistoryMap,
  roundNumber: number
): { matches: Match[]; exact: boolean; hitNodeLimit: boolean } {
  const exact = players.length <= EXACT_SEARCH_PLAYER_LIMIT;
  const candidateLimit = exact ? Infinity : CANDIDATE_LIMIT;
  let bestCost = Infinity;
  let bestMatches: Match[] = [];
  let nodes = 0;
  let hitNodeLimit = false;

  function dfs(remaining: Player[], matches: Match[], cost: number) {
    if (nodes++ > NODE_LIMIT) {
      hitNodeLimit = true;
      return;
    }
    if (cost >= bestCost) return;
    if (remaining.length === 0) {
      bestCost = cost;
      bestMatches = matches;
      return;
    }

    const candidates = generateMatchCandidates(
      remaining,
      playersMap,
      history,
      roundNumber,
      candidateLimit
    );

    for (const candidate of candidates) {
      const used = new Set(candidate.playerIds);
      dfs(
        remaining.filter((p) => !used.has(p.id)),
        [...matches, candidate.match],
        cost + candidate.cost
      );
      if (hitNodeLimit) break;
    }
  }

  dfs(players, [], 0);

  return { matches: bestMatches, exact: exact && !hitNodeLimit, hitNodeLimit };
}

function generateMatchCandidates(
  remaining: Player[],
  playersMap: Map<PlayerId, Player>,
  history: HistoryMap,
  roundNumber: number,
  limit: number
): MatchCandidate[] {
  if (remaining.length < 4) return [];

  const leader = remaining[0];
  const candidates: MatchCandidate[] = [];

  for (let i = 1; i < remaining.length - 2; i++) {
    for (let j = i + 1; j < remaining.length - 1; j++) {
      for (let k = j + 1; k < remaining.length; k++) {
        const group: [Player, Player, Player, Player] = [
          leader,
          remaining[i],
          remaining[j],
          remaining[k],
        ];
        candidates.push(...arrangeGroup(group, playersMap, history, roundNumber));
      }
    }
  }

  candidates.sort((a, b) => a.cost - b.cost);
  return Number.isFinite(limit) ? candidates.slice(0, limit) : candidates;
}

function arrangeGroup(
  group: [Player, Player, Player, Player],
  playersMap: Map<PlayerId, Player>,
  history: HistoryMap,
  roundNumber: number
): MatchCandidate[] {
  const splits: [[Player, Player], [Player, Player]][] = [
    [[group[0], group[1]], [group[2], group[3]]],
    [[group[0], group[2]], [group[1], group[3]]],
    [[group[0], group[3]], [group[1], group[2]]],
  ];

  return splits.map(([pairA, pairB]) => {
    const teamA = createTeam(pairA[0], pairA[1], history);
    const teamB = createTeam(pairB[0], pairB[1], history);
    const playerIds = group.map((p) => p.id);
    const noise = seededNoise(`${roundNumber}:${playerIds.slice().sort().join(':')}:${teamA.id}:${teamB.id}`);
    const cost =
      teammateCost(pairA[0], pairA[1], history) +
      teammateCost(pairB[0], pairB[1], history) +
      colorCostForTeam(pairA[0], pairA[1], history) +
      colorCostForTeam(pairB[0], pairB[1], history) +
      matchCost(teamA, teamB, playersMap, history) +
      noise * RANDOM_NOISE_WEIGHT;

    return {
      match: createMatch(teamA, teamB),
      cost,
      playerIds,
    };
  });
}

/**
 * 自动生成配对（Auto）
 * 当前与 SemiAuto 相同，预留扩展
 */
export function generateAutoPairing(input: PairingInput): PairingOutput {
  return generateSemiAutoPairing(input);
}

/**
 * 手动配对：返回空数组，由 UI 负责构建
 */
export function generateManualPairing(_input: PairingInput): PairingOutput {
  return { matches: [], warnings: [] };
}

// ==================== 工厂函数 ====================

function createTeam(p1: Player, p2: Player, history: HistoryMap): Team {
  const h1 = history.get(p1.id);
  const h2 = history.get(p2.id);
  const c1 = h1?.lastColor;
  const c2 = h2?.lastColor;

  let white: Player;
  let black: Player;

  // 优先让上轮执白者本轮执黑，上轮执黑者本轮执白
  if (c1 === 'white' && c2 !== 'white') {
    white = p2; black = p1;
  } else if (c2 === 'white' && c1 !== 'white') {
    white = p1; black = p2;
  } else if (c1 === 'black' && c2 !== 'black') {
    white = p1; black = p2;
  } else if (c2 === 'black' && c1 !== 'black') {
    white = p2; black = p1;
  } else {
    // 同颜色或都无记录，高种子（小 seed）白方
    white = p1.seed <= p2.seed ? p1 : p2;
    black = p1.seed <= p2.seed ? p2 : p1;
  }

  return {
    id: `team-${white.id}-${black.id}`,
    members: [
      { playerId: white.id, color: 'white' },
      { playerId: black.id, color: 'black' },
    ],
  };
}

function createMatch(teamA: Team, teamB: Team): Match {
  return {
    id: uid('match-'),
    teamA,
    teamB,
  };
}

// ==================== 对外统一入口 ====================

export function generatePairing(
  strategy: PairingStrategy,
  input: PairingInput
): PairingOutput {
  switch (strategy) {
    case 'manual':
      return generateManualPairing(input);
    case 'semiAuto':
      return generateSemiAutoPairing(input);
    case 'auto':
      return generateAutoPairing(input);
    default:
      return generateSemiAutoPairing(input);
  }
}

// ==================== 结果计算 ====================

export function calculateScores(players: Player[], rounds: Round[]): Player[] {
  const scoreMap = new Map<PlayerId, number>();
  const progressiveMap = new Map<PlayerId, number>();
  const opponentsMap = new Map<
    PlayerId,
    { opponentId: PlayerId; roundScore: number }[]
  >();

  for (const p of players) {
    scoreMap.set(p.id, 0);
    progressiveMap.set(p.id, 0);
    opponentsMap.set(p.id, []);
  }

  // 逐轮计算积分、累进分、记录对手
  for (const round of rounds) {
    for (const match of round.matches) {
      if (!match.result) continue;
      const { teamAScore, teamBScore } = match.result;

      const aIds = match.teamA.members.map((m) => m.playerId);
      const bIds = match.teamB.members.map((m) => m.playerId);

      // 更新个人积分
      for (const id of aIds) {
        scoreMap.set(id, (scoreMap.get(id) ?? 0) + teamAScore);
      }
      for (const id of bIds) {
        scoreMap.set(id, (scoreMap.get(id) ?? 0) + teamBScore);
      }

      // 记录对手关系（用于 Buchholz 和 SB）
      for (const aId of aIds) {
        for (const bId of bIds) {
          opponentsMap.get(aId)!.push({ opponentId: bId, roundScore: teamAScore });
          opponentsMap.get(bId)!.push({ opponentId: aId, roundScore: teamBScore });
        }
      }
    }

    // 每轮结束后累加 progressive（当前累计积分）
    for (const p of players) {
      progressiveMap.set(
        p.id,
        (progressiveMap.get(p.id) ?? 0) + (scoreMap.get(p.id) ?? 0)
      );
    }
  }

  // 使用最终积分计算 Buchholz 和 Sonneborn-Berger
  const buchholzMap = new Map<PlayerId, number>();
  const sbMap = new Map<PlayerId, number>();

  for (const p of players) {
    let bh = 0;
    let sb = 0;
    for (const opp of opponentsMap.get(p.id)!) {
      const oppFinalScore = scoreMap.get(opp.opponentId) ?? 0;
      bh += oppFinalScore;
      if (opp.roundScore === 1) {
        sb += oppFinalScore;
      } else if (opp.roundScore === 0.5) {
        sb += oppFinalScore * 0.5;
      }
    }
    buchholzMap.set(p.id, bh);
    sbMap.set(p.id, sb);
  }

  return players.map((p) => ({
    ...p,
    score: scoreMap.get(p.id) ?? 0,
    buchholz: buchholzMap.get(p.id) ?? 0,
    progressive: progressiveMap.get(p.id) ?? 0,
    sonnebornBerger: sbMap.get(p.id) ?? 0,
  }));
}

// ==================== 校验 ====================

export function validateRound(round: Round, allPlayerIds: Set<PlayerId>): string[] {
  const errors: string[] = [];
  const seen = new Set<PlayerId>();
  const validScores = new Set([0, 0.5, 1]);

  for (const match of round.matches) {
    if (!match.result) {
      errors.push(`对局 ${match.id} 尚未录入结果`);
    } else {
      const { teamAScore, teamBScore } = match.result;
      if (!validScores.has(teamAScore) || !validScores.has(teamBScore)) {
        errors.push(`对局 ${match.id} 结果分值无效`);
      }
      if (teamAScore + teamBScore !== 1) {
        errors.push(`对局 ${match.id} 双方得分合计必须为1`);
      }
    }

    for (const team of [match.teamA, match.teamB]) {
      if (team.members.length !== 2) {
        errors.push(`队伍 ${team.id} 成员数不是2`);
      }
      for (const m of team.members) {
        if (seen.has(m.playerId)) {
          errors.push(`玩家 ${m.playerId} 在一轮中出现多次`);
        }
        seen.add(m.playerId);
        if (!allPlayerIds.has(m.playerId)) {
          errors.push(`未知玩家 ${m.playerId}`);
        }
      }
    }
  }

  return errors;
}
