import type {
  Player,
  PlayerId,
  Team,
  Match,
  MatchResult,
  Round,
  HistoryMap,
  PlayerHistory,
  PairingInput,
  PairingOutput,
  PairingStrategy,
} from './types';

// ==================== 工具函数 ====================

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

/** 队友匹配优先级分数（越低越好） */
function teammateScore(p1: Player, p2: Player, history: HistoryMap): number {
  const h1 = history.get(p1.id) ?? emptyHistory();
  const h2 = history.get(p2.id) ?? emptyHistory();

  // 是否合作过（最重惩罚）
  const hasTeamed = h1.teammates.has(p2.id) || h2.teammates.has(p1.id);
  const teamedPenalty = hasTeamed ? 10000 : 0;

  // 种子差距：差距越大越好，差距小则分数高（不好）
  const seedDiff = Math.abs(p1.seed - p2.seed);
  const seedScore = (64 - seedDiff) * 10; // 最大差距63时分数最低（最好）

  // 少量随机性，避免固定模式
  const randomNoise = Math.random() * 20;

  return teamedPenalty + seedScore + randomNoise;
}

/** 队伍对阵优先级分数（越低越好） */
function matchScore(teamA: Team, teamB: Team, playersMap: Map<PlayerId, Player>): number {
  const seedA = teamA.members.reduce((sum, m) => sum + (playersMap.get(m.playerId)?.seed ?? 0), 0);
  const seedB = teamB.members.reduce((sum, m) => sum + (playersMap.get(m.playerId)?.seed ?? 0), 0);
  return Math.abs(seedA - seedB);
}

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
  const unassigned = new Set<PlayerId>(sortedPlayers.map((p) => p.id));
  const teams: Team[] = [];

  // ---- 第一步：组成 2 人队伍 ----
  while (unassigned.size >= 2) {
    // 取当前 score 最高的未分配玩家
    const candidates = sortedPlayers.filter((p) => unassigned.has(p.id));
    if (candidates.length < 2) break;

    const leader = candidates[0];
    unassigned.delete(leader.id);

    // 为 leader 找最佳队友
    let bestMate: Player | null = null;
    let bestScore = Infinity;

    for (const mate of candidates.slice(1)) {
      if (!unassigned.has(mate.id)) continue;
      const score = teammateScore(leader, mate, history);
      if (score < bestScore) {
        bestScore = score;
        bestMate = mate;
      }
    }

    if (bestMate) {
      unassigned.delete(bestMate.id);
      teams.push(createTeam(leader, bestMate, history));
    } else {
      warnings.push(`玩家 ${leader.name} 无法找到队友`);
    }
  }

  // 剩余无法组队的人
  if (unassigned.size > 0) {
    const leftover = Array.from(unassigned).map((id) => playersMap.get(id)!.name);
    warnings.push(`以下玩家本轮轮空：${leftover.join('、')}`);
  }

  // ---- 第二步：将队伍配成 Match ----
  const unpairedTeams = [...teams];
  const matches: Match[] = [];

  while (unpairedTeams.length >= 2) {
    const leaderTeam = unpairedTeams.shift()!;

    let bestOpponentIdx = -1;
    let bestScore = Infinity;

    for (let i = 0; i < unpairedTeams.length; i++) {
      const score = matchScore(leaderTeam, unpairedTeams[i], playersMap);
      if (score < bestScore) {
        bestScore = score;
        bestOpponentIdx = i;
      }
    }

    if (bestOpponentIdx >= 0) {
      const opponent = unpairedTeams.splice(bestOpponentIdx, 1)[0];
      matches.push(createMatch(leaderTeam, opponent));
    } else {
      warnings.push(`队伍 ${teamName(leaderTeam, playersMap)} 无法找到对手`);
    }
  }

  if (unpairedTeams.length > 0) {
    const t = unpairedTeams[0];
    warnings.push(`队伍 ${teamName(t, playersMap)} 无法配对对手`);
  }

  return { matches, warnings };
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
    id: uid('team-'),
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

function teamName(team: Team, playersMap: Map<PlayerId, Player>): string {
  return team.members.map((m) => playersMap.get(m.playerId)?.name ?? '?').join(' + ');
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

  for (const match of round.matches) {
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
