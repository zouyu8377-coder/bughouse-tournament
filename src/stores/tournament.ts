import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type {
  Tournament,
  Player,
  Round,
  MatchResult,
  PlayerId,
  PairingStrategy,
} from '../domain/types';
import {
  generatePairing,
  buildHistory,
  calculateScores,
  validateRound,
  getBoardsForTeams,
} from '../domain/pairingEngine';
import {
  saveTournament,
  loadTournament,
  listTournaments,
  deleteTournament,
} from '../db/database';

let _idCounter = 0;
function uid(prefix = ''): string {
  return prefix + (++_idCounter).toString(36) + Date.now().toString(36).slice(-4);
}

export const useTournamentStore = defineStore('tournament', () => {
  // ==================== State ====================
  const tournament = ref<Tournament | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const warnings = ref<string[]>([]);

  // ==================== Getters ====================
  const currentRoundObj = computed<Round | undefined>(() => {
    if (!tournament.value) return undefined;
    return tournament.value.rounds.find(
      (r) => r.roundNumber === tournament.value!.currentRound
    );
  });

  const currentRoundLocked = computed(() => currentRoundObj.value?.locked ?? false);

  const playersWithScores = computed<Player[]>(() => {
    if (!tournament.value) return [];
    return calculateScores(tournament.value.players, tournament.value.rounds);
  });

  const sortedPlayers = computed<Player[]>(() => {
    return [...playersWithScores.value].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
      if (b.progressive !== a.progressive) return b.progressive - a.progressive;
      if (b.sonnebornBerger !== a.sonnebornBerger) return b.sonnebornBerger - a.sonnebornBerger;
      return a.seed - b.seed; // 小种子号（高种子）优先
    });
  });

  const historyMap = computed(() => {
    if (!tournament.value) return new Map();
    return buildHistory(tournament.value.rounds);
  });

  const allPlayerIds = computed(() => {
    return new Set(tournament.value?.players.map((p) => p.id) ?? []);
  });

  // ==================== Actions ====================

  async function createTournament(
    name: string,
    playersInput: { name: string; seed: number }[],
    totalRounds: number
  ) {
    const id = uid('tour-');
    const players: Player[] = playersInput.map((p) => ({
      id: uid('pl-'),
      name: p.name,
      rating: 0,
      seed: p.seed,
      score: 0,
      buchholz: 0,
      progressive: 0,
      sonnebornBerger: 0,
    }));

    tournament.value = {
      id,
      name,
      players,
      rounds: [],
      currentRound: 0,
      totalRounds,
    };

    await persist();
  }

  async function load(id: string) {
    isLoading.value = true;
    try {
      const t = await loadTournament(id);
      if (t) {
        tournament.value = t;
      } else {
        error.value = '比赛未找到';
      }
    } finally {
      isLoading.value = false;
    }
  }

  async function removeTournament(id: string) {
    await deleteTournament(id);
    if (tournament.value?.id === id) {
      tournament.value = null;
    }
  }

  async function persist() {
    if (tournament.value) {
      await saveTournament(tournament.value);
    }
  }

  // ---- 轮次管理 ----

  function startNewRound(strategy: PairingStrategy = 'semiAuto') {
    if (!tournament.value) return;
    if (currentRoundObj.value && !currentRoundObj.value.locked) {
      error.value = '当前轮次未锁定，无法进入下一轮';
      return;
    }

    const roundNumber = tournament.value.currentRound + 1;
    const roundId = `${tournament.value.id}-round-${roundNumber}`;

    const input = {
      players: playersWithScores.value,
      history: historyMap.value,
      roundNumber,
      previousRounds: tournament.value.rounds,
    };

    const output = generatePairing(strategy, input);
    warnings.value = output.warnings;

    // 手动配对时，预生成空对局槽位
    const matches = output.matches;
    if (strategy === 'manual' && matches.length === 0) {
      const matchCount = Math.floor(tournament.value.players.length / 4);
      for (let i = 0; i < matchCount; i++) {
        matches.push({
          id: uid('match-'),
          teamA: { id: uid('team-'), members: [] as any },
          teamB: { id: uid('team-'), members: [] as any },
        });
      }
    }

    const newRound: Round = {
      id: roundId,
      roundNumber,
      matches,
      locked: false,
      strategy,
    };

    tournament.value.rounds.push(newRound);
    tournament.value.currentRound = roundNumber;
    rebuildCurrentRoundBoards();
    persist();
  }

  function lockCurrentRound() {
    if (!tournament.value || !currentRoundObj.value) return;
    const errs = validateRound(currentRoundObj.value, allPlayerIds.value);
    if (errs.length > 0) {
      error.value = '轮次校验失败：' + errs.join('; ');
      return;
    }
    currentRoundObj.value.locked = true;
    persist();
  }

  function unlockCurrentRound() {
    if (!tournament.value || !currentRoundObj.value) return;
    currentRoundObj.value.locked = false;
    persist();
  }

  function goToRound(n: number) {
    if (!tournament.value) return;
    tournament.value.currentRound = n;
  }

  // ---- 结果录入 ----

  function setMatchResult(matchId: string, result: MatchResult) {
    if (!currentRoundObj.value || currentRoundObj.value.locked) return;
    const match = currentRoundObj.value.matches.find((m) => m.id === matchId);
    if (match) {
      match.result = result;
      // 更新玩家分数
      tournament.value!.players = calculateScores(tournament.value!.players, tournament.value!.rounds);
      persist();
    }
  }

  // ---- 手动配对操作 ----

  function addEmptyMatch() {
    if (!currentRoundObj.value || currentRoundObj.value.locked) return;
    currentRoundObj.value.matches.push({
      id: uid('match-'),
      teamA: { id: uid('team-'), members: [] as any },
      teamB: { id: uid('team-'), members: [] as any },
    });
    rebuildCurrentRoundBoards();
    persist();
  }

  function removeMatch(matchId: string) {
    if (!currentRoundObj.value || currentRoundObj.value.locked) return;
    currentRoundObj.value.matches = currentRoundObj.value.matches.filter((m) => m.id !== matchId);
    rebuildCurrentRoundBoards();
    persist();
  }

  function assignPlayerToMatch(matchId: string, teamSide: 'A' | 'B', playerId: PlayerId) {
    if (!currentRoundObj.value || currentRoundObj.value.locked) return;
    const match = currentRoundObj.value.matches.find((m) => m.id === matchId);
    if (!match) return;

    // 先从其他位置移除该玩家
    removePlayerFromCurrentRound(playerId);

    const team = teamSide === 'A' ? match.teamA : match.teamB;
    if (team.members.length >= 2) return; // 队伍已满

    // 自动分配颜色：第一个加入为 white，第二个为 black
    const color = team.members.length === 0 ? 'white' : 'black';
    team.members.push({ playerId, color });

    rebuildCurrentRoundBoards();
    persist();
  }

  function removePlayerFromTeam(matchId: string, teamSide: 'A' | 'B', playerId: PlayerId) {
    if (!currentRoundObj.value || currentRoundObj.value.locked) return;
    const match = currentRoundObj.value.matches.find((m) => m.id === matchId);
    if (!match) return;
    const team = teamSide === 'A' ? match.teamA : match.teamB;
    team.members = team.members.filter((m) => m.playerId !== playerId);
    rebuildCurrentRoundBoards();
    persist();
  }

  function removePlayerFromCurrentRound(playerId: PlayerId) {
    if (!currentRoundObj.value) return;
    for (const match of currentRoundObj.value.matches) {
      match.teamA.members = match.teamA.members.filter((m) => m.playerId !== playerId);
      match.teamB.members = match.teamB.members.filter((m) => m.playerId !== playerId);
    }
    rebuildCurrentRoundBoards();
  }

  function swapPlayers(matchId: string, teamSide: 'A' | 'B', idx1: number, idx2: number) {
    if (!currentRoundObj.value || currentRoundObj.value.locked) return;
    const match = currentRoundObj.value.matches.find((m) => m.id === matchId);
    if (!match) return;
    const team = teamSide === 'A' ? match.teamA : match.teamB;
    const tmp = team.members[idx1];
    team.members[idx1] = team.members[idx2];
    team.members[idx2] = tmp;
    rebuildCurrentRoundBoards();
    persist();
  }

  function regenerateCurrentRound(strategy: PairingStrategy = 'semiAuto') {
    if (!tournament.value || !currentRoundObj.value) return;
    if (currentRoundObj.value.locked) {
      error.value = '当前轮次已锁定，无法重新生成';
      return;
    }

    const previousRounds = tournament.value.rounds.filter(
      (r) => r.roundNumber < currentRoundObj.value!.roundNumber
    );

    const input = {
      players: calculateScores(tournament.value.players, previousRounds),
      history: buildHistory(previousRounds),
      roundNumber: currentRoundObj.value.roundNumber,
      previousRounds,
    };

    const output = generatePairing(strategy, input);
    warnings.value = output.warnings;
    currentRoundObj.value.matches = output.matches;
    currentRoundObj.value.strategy = strategy;
    rebuildCurrentRoundBoards();
    persist();
  }

  function rebuildCurrentRoundBoards() {
    if (!currentRoundObj.value) return;
    currentRoundObj.value.matches.forEach((match, index) => {
      if (match.teamA.members.length === 2 && match.teamB.members.length === 2) {
        const boards = getBoardsForTeams(match.teamA, match.teamB);
        match.boards = [
          { ...boards[0], boardNumber: index * 2 + 1 },
          { ...boards[1], boardNumber: index * 2 + 2 },
        ];
      } else {
        match.boards = undefined;
      }
    });
  }

  function clearError() {
    error.value = null;
  }

  // ==================== 返回 ====================
  return {
    tournament,
    isLoading,
    error,
    warnings,
    currentRoundObj,
    currentRoundLocked,
    playersWithScores,
    sortedPlayers,
    historyMap,
    createTournament,
    load,
    removeTournament,
    persist,
    startNewRound,
    lockCurrentRound,
    unlockCurrentRound,
    goToRound,
    setMatchResult,
    addEmptyMatch,
    removeMatch,
    assignPlayerToMatch,
    removePlayerFromTeam,
    swapPlayers,
    regenerateCurrentRound,
    clearError,
    listTournaments,
  };
});
