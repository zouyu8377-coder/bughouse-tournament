<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTournamentStore } from '../stores/tournament';
import type { Board, Match, PlayerId, PairingStrategy } from '../domain/types';

const emit = defineEmits<{ (e: 'go-scores'): void }>();
const store = useTournamentStore();

const roundSelector = computed(() => {
  if (!store.tournament) return [];
  return store.tournament.rounds.map((r) => ({
    number: r.roundNumber,
    label: `第 ${r.roundNumber} 轮`,
    locked: r.locked,
  }));
});

const currentStrategy = ref<PairingStrategy>('semiAuto');

function startRound() {
  store.startNewRound(currentStrategy.value);
}

function regenerate() {
  store.regenerateCurrentRound(currentStrategy.value);
}

function lockRound() {
  store.lockCurrentRound();
  emit('go-scores');
}

// ==================== 拖拽相关 ====================
const playerListRef = ref<HTMLElement | null>(null);
const matchRefs = ref<Map<string, HTMLElement>>(new Map());

function setMatchRef(el: HTMLElement | null, matchId: string) {
  if (el) matchRefs.value.set(matchId, el);
}

const draggedPlayer = ref<PlayerId | null>(null);

function onPlayerDragStart(playerId: PlayerId) {
  draggedPlayer.value = playerId;
}

function onDropToTeam(matchId: string, side: 'A' | 'B') {
  if (draggedPlayer.value) {
    store.assignPlayerToMatch(matchId, side, draggedPlayer.value);
    draggedPlayer.value = null;
  }
}

function getPlayerName(id: PlayerId) {
  return store.tournament?.players.find((p) => p.id === id)?.name ?? '?';
}

function getPlayerSeed(id: PlayerId) {
  return store.tournament?.players.find((p) => p.id === id)?.seed ?? 0;
}

function teamSeedSum(team: { members: { playerId: PlayerId }[] }) {
  return team.members.reduce((sum, m) => sum + getPlayerSeed(m.playerId), 0);
}

function getBoards(match: Match): [Board, Board] | [] {
  if (match.boards) return match.boards;
  if (match.teamA.members.length !== 2 || match.teamB.members.length !== 2) return [];

  const aWhite = match.teamA.members.find((m) => m.color === 'white') ?? match.teamA.members[0];
  const aBlack = match.teamA.members.find((m) => m.color === 'black') ?? match.teamA.members[1];
  const bWhite = match.teamB.members.find((m) => m.color === 'white') ?? match.teamB.members[0];
  const bBlack = match.teamB.members.find((m) => m.color === 'black') ?? match.teamB.members[1];

  return [
    { boardNumber: 0, whitePlayerId: aWhite.playerId, blackPlayerId: bBlack.playerId },
    { boardNumber: 0, whitePlayerId: bWhite.playerId, blackPlayerId: aBlack.playerId },
  ];
}

const unassignedPlayers = computed(() => {
  if (!store.tournament || !store.currentRoundObj) return [];
  const assigned = new Set<PlayerId>();
  for (const match of store.currentRoundObj.matches) {
    for (const m of match.teamA.members) assigned.add(m.playerId);
    for (const m of match.teamB.members) assigned.add(m.playerId);
  }
  return store.tournament.players.filter((p) => !assigned.has(p.id));
});

const warnings = computed(() => store.warnings);
</script>

<template>
  <div v-if="!store.tournament">请先创建比赛。</div>
  <div v-else class="pairing-board">
    <!-- 轮次控制 -->
    <div class="round-control">
      <div class="round-tabs">
        <button
          v-for="r in roundSelector"
          :key="r.number"
          :class="['round-tab', { active: store.tournament!.currentRound === r.number, locked: r.locked }]"
          @click="store.goToRound(r.number)"
        >
          {{ r.label }}
          <span v-if="r.locked" class="lock-icon">🔒</span>
        </button>
        <button
          class="round-tab add"
          @click="startRound"
          :disabled="store.currentRoundObj ? !store.currentRoundLocked : false"
        >
          + 新一轮
        </button>
      </div>

      <div class="round-actions" v-if="store.currentRoundObj">
        <select v-model="currentStrategy" :disabled="store.currentRoundLocked">
          <option value="manual">手动配对</option>
          <option value="semiAuto">半自动配对</option>
          <option value="auto">自动配对</option>
        </select>

        <button
          v-if="!store.currentRoundLocked"
          @click="regenerate"
          :disabled="store.currentRoundObj.strategy === 'manual'"
        >
          重新生成配对
        </button>

        <button
          v-if="!store.currentRoundLocked"
          class="btn-lock"
          @click="lockRound"
        >
          锁定本轮
        </button>

        <button
          v-else
          class="btn-unlock"
          @click="store.unlockCurrentRound()"
        >
          解锁本轮
        </button>
      </div>
    </div>

    <!-- 警告 -->
    <div v-if="warnings.length > 0" class="warnings">
      <div v-for="(w, i) in warnings" :key="i" class="warning">⚠️ {{ w }}</div>
    </div>

    <!-- 当前轮次未创建 -->
    <div v-if="!store.currentRoundObj" class="empty-state">
      <p>当前没有进行中的轮次。</p>
      <button class="btn-primary" @click="startRound">开始第 {{ store.tournament.currentRound + 1 }} 轮</button>
    </div>

    <div v-else class="board">
      <!-- 未分配选手池 -->
      <div class="player-pool">
        <h3>未分配选手（{{ unassignedPlayers.length }}）</h3>
        <div class="player-list" ref="playerListRef">
          <div
            v-for="p in unassignedPlayers"
            :key="p.id"
            class="player-chip"
            draggable="true"
            @dragstart="onPlayerDragStart(p.id)"
          >
            <span class="name">{{ p.name }}</span>
            <span class="seed">{{ p.seed }}</span>
          </div>
        </div>
      </div>

      <!-- 对阵表 -->
      <div class="matches">
        <div class="matches-header">
          <h3>第 {{ store.currentRoundObj.roundNumber }} 轮对阵</h3>
          <button
            v-if="!store.currentRoundLocked"
            class="btn-small"
            @click="store.addEmptyMatch()"
          >
            + 添加空对局
          </button>
        </div>

        <div
          v-for="match in store.currentRoundObj.matches"
          :key="match.id"
          class="match-row"
          :ref="(el) => setMatchRef(el as HTMLElement, match.id)"
        >
          <!-- Team A -->
          <div
            class="team"
            :class="{ 'drop-target': !store.currentRoundLocked }"
            @dragover.prevent
            @drop.prevent="onDropToTeam(match.id, 'A')"
          >
            <div class="team-header">
              <span class="team-label">A队</span>
              <span class="team-seed">{{ teamSeedSum(match.teamA) }}</span>
            </div>
            <div class="team-members">
              <div
                v-for="(m, idx) in match.teamA.members"
                :key="m.playerId"
                class="member"
              >
                <span class="color-dot" :class="m.color"></span>
                <span class="name">{{ getPlayerName(m.playerId) }}</span>
                <button
                  v-if="!store.currentRoundLocked"
                  class="btn-remove"
                  @click="store.removePlayerFromTeam(match.id, 'A', m.playerId)"
                >
                  ×
                </button>
              </div>
              <div v-if="match.teamA.members.length < 2" class="member-placeholder">
                拖拽选手至此
              </div>
            </div>
          </div>

          <!-- Boards -->
          <div class="boards">
            <div
              v-for="(board, boardIdx) in getBoards(match)"
              :key="`${match.id}-${boardIdx}`"
              class="board-line"
            >
              <div class="board-title">
                第 {{ board.boardNumber || boardIdx + 1 }} 台
              </div>
              <div class="board-players">
                <span class="board-player">
                  <span class="color-dot white"></span>
                  {{ getPlayerName(board.whitePlayerId) }}
                </span>
                <span class="board-vs">vs</span>
                <span class="board-player">
                  <span class="color-dot black"></span>
                  {{ getPlayerName(board.blackPlayerId) }}
                </span>
              </div>
            </div>
            <div v-if="getBoards(match).length === 0" class="boards-placeholder">
              队伍满员后生成台次
            </div>
          </div>

          <!-- Team B -->
          <div
            class="team"
            :class="{ 'drop-target': !store.currentRoundLocked }"
            @dragover.prevent
            @drop.prevent="onDropToTeam(match.id, 'B')"
          >
            <div class="team-header">
              <span class="team-label">B队</span>
              <span class="team-seed">{{ teamSeedSum(match.teamB) }}</span>
            </div>
            <div class="team-members">
              <div
                v-for="(m, idx) in match.teamB.members"
                :key="m.playerId"
                class="member"
              >
                <span class="color-dot" :class="m.color"></span>
                <span class="name">{{ getPlayerName(m.playerId) }}</span>
                <button
                  v-if="!store.currentRoundLocked"
                  class="btn-remove"
                  @click="store.removePlayerFromTeam(match.id, 'B', m.playerId)"
                >
                  ×
                </button>
              </div>
              <div v-if="match.teamB.members.length < 2" class="member-placeholder">
                拖拽选手至此
              </div>
            </div>
          </div>

          <!-- 结果 -->
          <div class="result">
            <div v-if="match.result" class="result-display">
              {{ match.result.teamAScore }} : {{ match.result.teamBScore }}
            </div>
            <div v-else-if="!store.currentRoundLocked" class="result-input">
              <button @click="store.setMatchResult(match.id, { teamAScore: 1, teamBScore: 0 })">A胜</button>
              <button @click="store.setMatchResult(match.id, { teamAScore: 0, teamBScore: 1 })">B胜</button>
              <button @click="store.setMatchResult(match.id, { teamAScore: 0.5, teamBScore: 0.5 })">平局</button>
            </div>
            <div v-else class="result-pending">待录入</div>

            <button
              v-if="!store.currentRoundLocked"
              class="btn-remove-match"
              @click="store.removeMatch(match.id)"
            >
              删除对局
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.round-control {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.round-tabs {
  display: flex;
  gap: 4px;
}

.round-tab {
  padding: 6px 12px;
  border: 1px solid #b2bec3;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.round-tab.active {
  background: #0984e3;
  color: white;
  border-color: #0984e3;
}

.round-tab.locked {
  opacity: 0.7;
}

.round-tab.add {
  border-style: dashed;
  color: #0984e3;
}

.round-tab:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.lock-icon {
  font-size: 10px;
}

.round-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.round-actions select {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #b2bec3;
}

.round-actions button {
  padding: 6px 12px;
  border: 1px solid #b2bec3;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.btn-lock {
  background: #00b894 !important;
  color: white !important;
  border-color: #00b894 !important;
}

.btn-unlock {
  background: #fdcb6e !important;
  color: #2d3436 !important;
  border-color: #fdcb6e !important;
}

.warnings {
  margin-bottom: 12px;
}

.warning {
  background: #fff3cd;
  color: #856404;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 13px;
  margin-bottom: 4px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #636e72;
}

.board {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
}

.player-pool {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}

.player-pool h3 {
  margin: 0 0 10px;
  font-size: 14px;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-chip {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: white;
  border: 1px solid #dfe6e9;
  border-radius: 6px;
  cursor: grab;
  font-size: 13px;
}

.player-chip:active {
  cursor: grabbing;
}

.player-chip .seed {
  color: #636e72;
  font-size: 11px;
}

.matches {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}

.matches-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.matches-header h3 {
  margin: 0;
  font-size: 14px;
}

.match-row {
  display: grid;
  grid-template-columns: 1fr minmax(220px, 1.2fr) 1fr auto;
  gap: 12px;
  align-items: start;
  background: white;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  border: 1px solid #dfe6e9;
}

.team {
  min-width: 0;
}

.team.drop-target {
  border: 2px dashed #b2bec3;
  border-radius: 6px;
  padding: 8px;
  min-height: 80px;
}

.team-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #636e72;
  margin-bottom: 6px;
}

.team-members {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.member {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 13px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid #b2bec3;
}

.color-dot.white {
  background: white;
}

.color-dot.black {
  background: #2d3436;
}

.member-placeholder {
  padding: 8px;
  color: #b2bec3;
  font-size: 12px;
  text-align: center;
  border: 1px dashed #dfe6e9;
  border-radius: 4px;
}

.btn-remove {
  margin-left: auto;
  background: none;
  border: none;
  color: #d63031;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 80px;
}

.boards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.board-line {
  border: 1px solid #dfe6e9;
  border-radius: 6px;
  padding: 8px;
  background: #f8f9fa;
}

.board-title {
  font-size: 11px;
  font-weight: 700;
  color: #636e72;
  margin-bottom: 6px;
}

.board-players {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.board-player {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.board-player:last-child {
  justify-content: flex-end;
}

.board-vs {
  color: #636e72;
  font-size: 11px;
  font-weight: 700;
}

.boards-placeholder {
  padding: 16px 8px;
  text-align: center;
  color: #b2bec3;
  font-size: 12px;
  border: 1px dashed #dfe6e9;
  border-radius: 6px;
}

.result-display {
  font-size: 18px;
  font-weight: 700;
  color: #2d3436;
}

.result-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.result-input button {
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid #b2bec3;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.result-pending {
  font-size: 12px;
  color: #b2bec3;
}

.btn-remove-match {
  font-size: 11px;
  color: #d63031;
  background: none;
  border: none;
  cursor: pointer;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #b2bec3;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  padding: 10px 20px;
  background: #0984e3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
</style>
