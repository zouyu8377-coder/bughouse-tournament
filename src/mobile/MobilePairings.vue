<script setup lang="ts">
import { computed } from 'vue';
import { getBoardsForTeams } from '../domain/pairingEngine';
import type { Board, Match, PairingStrategy, PlayerId, Team } from '../domain/types';
import { useTournamentStore } from '../stores/tournament';

const emit = defineEmits<{ (event: 'go-scores'): void }>();

const store = useTournamentStore();

const pairingStrategy = computed({
  get: () => store.tournament?.pairingStrategy ?? 'semiAuto',
  set: (strategy: PairingStrategy) => store.setPairingStrategy(strategy),
});

const roundSelector = computed(() => {
  if (!store.tournament) return [];
  return store.tournament.rounds.map((round) => ({
    number: round.roundNumber,
    locked: round.locked,
  }));
});

const currentRoundComplete = computed(() => {
  const matches = store.currentRoundObj?.matches ?? [];
  return matches.length > 0 && matches.every((match) => !!match.result);
});

const completedMatches = computed(() => {
  return (store.currentRoundObj?.matches ?? []).filter((match) => !!match.result).length;
});

const totalMatches = computed(() => store.currentRoundObj?.matches.length ?? 0);

const resultProgressLabel = computed(() => {
  if (!store.currentRoundObj) return 'No active round';
  return `${completedMatches.value} of ${totalMatches.value} results entered`;
});

const canStartRound = computed(() => {
  if (!store.tournament) return false;
  if (store.tournament.currentRound >= store.tournament.totalRounds) return false;
  return !store.currentRoundObj || store.currentRoundLocked;
});

const unassignedPlayers = computed(() => {
  if (!store.tournament || !store.currentRoundObj) return [];
  const assigned = new Set<PlayerId>();
  for (const match of store.currentRoundObj.matches) {
    for (const member of match.teamA.members) assigned.add(member.playerId);
    for (const member of match.teamB.members) assigned.add(member.playerId);
  }
  return [...store.tournament.players]
    .filter((player) => !assigned.has(player.id))
    .sort((a, b) => a.seed - b.seed);
});

const activePlayersLabel = computed(() => {
  const count = unassignedPlayers.value.length;
  return count === 1 ? '1 unassigned player' : `${count} unassigned players`;
});

function getPlayerName(id: PlayerId) {
  return store.tournament?.players.find((player) => player.id === id)?.name ?? 'Unknown';
}

function getPlayerSeed(id: PlayerId) {
  return store.tournament?.players.find((player) => player.id === id)?.seed ?? 0;
}

function teamScore(team: Team) {
  return team.members.reduce((sum, member) => sum + getPlayerSeed(member.playerId), 0);
}

function getBoards(match: Match): [Board, Board] | [] {
  if (match.boards) return match.boards;
  if (match.teamA.members.length !== 2 || match.teamB.members.length !== 2) return [];
  return getBoardsForTeams(match.teamA, match.teamB);
}

function resultLabel(match: Match) {
  if (!match.result) return 'Pending';
  if (match.result.teamAScore === 1) return 'Team A win';
  if (match.result.teamBScore === 1) return 'Team B win';
  return 'Draw';
}

function resultScoreLabel(match: Match) {
  if (!match.result) return 'No result yet';
  return `${match.result.teamAScore} : ${match.result.teamBScore}`;
}

function isResultSelected(match: Match, teamAScore: number, teamBScore: number) {
  return match.result?.teamAScore === teamAScore && match.result.teamBScore === teamBScore;
}

function startRound() {
  store.startNewRound();
}

function regenerateRound() {
  store.regenerateCurrentRound();
}

function confirmRound() {
  store.lockCurrentRound();
  if (store.currentRoundLocked) {
    emit('go-scores');
  }
}

function assignFromSelect(event: Event, matchId: string, side: 'A' | 'B') {
  const select = event.target as HTMLSelectElement;
  if (!select.value) return;
  store.assignPlayerToMatch(matchId, side, select.value);
  select.value = '';
}
</script>

<template>
  <section v-if="!store.tournament" class="pairings-empty">
    <h2>Create a tournament first</h2>
    <p>Pairings are generated after players are added to the tournament.</p>
  </section>

  <section v-else class="mobile-pairings">
    <header class="pairings-header">
      <div>
        <span class="eyebrow">Pairings</span>
        <h2>
          Round
          {{ store.tournament.currentRound || 1 }}
          of {{ store.tournament.totalRounds }}
        </h2>
      </div>
      <span class="round-state">
        {{ store.currentRoundLocked ? 'Confirmed' : currentRoundComplete ? 'Ready to confirm' : 'Open' }}
      </span>
    </header>

    <div class="round-toolbar">
      <div v-if="roundSelector.length" class="round-tabs" aria-label="Round selector">
        <button
          v-for="round in roundSelector"
          :key="round.number"
          type="button"
          :class="['round-tab', { active: store.tournament.currentRound === round.number }]"
          @click="store.goToRound(round.number)"
        >
          R{{ round.number }}{{ round.locked ? ' locked' : '' }}
        </button>
      </div>

      <div class="strategy-row">
        <label for="pairing-strategy">Strategy</label>
        <select
          id="pairing-strategy"
          v-model="pairingStrategy"
          :disabled="store.tournamentStarted"
        >
          <option value="semiAuto">Semi-auto</option>
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </select>
        <p class="strategy-note">
          {{ store.tournamentStarted ? 'Strategy is locked after the first round is generated.' : 'Choose once before the tournament starts.' }}
        </p>
      </div>

      <div class="toolbar-actions">
        <button
          v-if="!store.currentRoundObj"
          type="button"
          class="primary"
          :disabled="!canStartRound"
          @click="startRound"
        >
          Generate Round 1
        </button>

        <template v-else>
          <button
            v-if="store.currentRoundLocked && store.tournament.currentRound < store.tournament.totalRounds"
            type="button"
            class="primary"
            @click="startRound"
          >
            Generate Next Round
          </button>
          <button
            v-if="!store.currentRoundLocked"
            type="button"
            class="secondary"
            :disabled="store.currentRoundObj.strategy === 'manual'"
            @click="regenerateRound"
          >
            Regenerate
          </button>
          <button
            v-if="!store.currentRoundLocked"
            type="button"
            class="primary"
            :disabled="!currentRoundComplete"
            @click="confirmRound"
          >
            Confirm Round
          </button>
          <button
            v-else
            type="button"
            class="secondary"
            @click="store.unlockCurrentRound()"
          >
            Unlock
          </button>
        </template>
      </div>
    </div>

    <div v-if="store.warnings.length" class="warning-list">
      <p v-for="warning in store.warnings" :key="warning">{{ warning }}</p>
    </div>

    <div v-if="!store.currentRoundObj" class="empty-round">
      <h3>No active round</h3>
      <p>Generate the first round when the player list is ready.</p>
    </div>

    <template v-else>
      <div
        class="round-progress-card"
        :class="{ complete: currentRoundComplete, locked: store.currentRoundLocked }"
      >
        <div>
          <strong>{{ resultProgressLabel }}</strong>
          <span>
            {{
              store.currentRoundLocked
                ? 'This round is confirmed.'
                : currentRoundComplete
                  ? 'All results are in. Confirm this round to continue.'
                  : 'Enter each match result directly on the card.'
            }}
          </span>
        </div>
      </div>

      <div
        v-if="!store.currentRoundLocked && store.currentRoundObj.strategy === 'manual'"
        class="manual-panel"
      >
        <div>
          <strong>Manual setup</strong>
          <span>{{ activePlayersLabel }}</span>
        </div>
        <button type="button" class="secondary" @click="store.addEmptyMatch()">
          Add Match
        </button>
      </div>

      <div class="match-list">
        <article
          v-for="(match, index) in store.currentRoundObj.matches"
          :key="match.id"
          class="match-card"
        >
          <header class="match-card-header">
            <div>
              <span class="eyebrow">Round {{ store.currentRoundObj.roundNumber }}</span>
              <h3>Match {{ index + 1 }}</h3>
            </div>
            <span class="result-pill" :class="{ done: !!match.result }">
              {{ resultLabel(match) }}
            </span>
          </header>

          <div class="result-summary" :class="{ done: !!match.result }">
            <span>{{ resultScoreLabel(match) }}</span>
            <strong>{{ match.result ? 'Tap another result to change it' : 'Choose a result' }}</strong>
          </div>

          <div class="teams">
            <div class="team-card">
              <div class="team-title">
                <strong>Team A</strong>
                <span>Seed sum {{ teamScore(match.teamA) }}</span>
              </div>
              <div class="team-members">
                <div
                  v-for="member in match.teamA.members"
                  :key="member.playerId"
                  class="member-row"
                >
                  <span class="color-dot" :class="member.color"></span>
                  <span>{{ getPlayerName(member.playerId) }}</span>
                  <button
                    v-if="!store.currentRoundLocked"
                    type="button"
                    @click="store.removePlayerFromTeam(match.id, 'A', member.playerId)"
                  >
                    Remove
                  </button>
                </div>
                <select
                  v-if="!store.currentRoundLocked && match.teamA.members.length < 2"
                  @change="assignFromSelect($event, match.id, 'A')"
                >
                  <option value="">Add player</option>
                  <option
                    v-for="player in unassignedPlayers"
                    :key="player.id"
                    :value="player.id"
                  >
                    #{{ player.seed }} {{ player.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="versus">vs</div>

            <div class="team-card">
              <div class="team-title">
                <strong>Team B</strong>
                <span>Seed sum {{ teamScore(match.teamB) }}</span>
              </div>
              <div class="team-members">
                <div
                  v-for="member in match.teamB.members"
                  :key="member.playerId"
                  class="member-row"
                >
                  <span class="color-dot" :class="member.color"></span>
                  <span>{{ getPlayerName(member.playerId) }}</span>
                  <button
                    v-if="!store.currentRoundLocked"
                    type="button"
                    @click="store.removePlayerFromTeam(match.id, 'B', member.playerId)"
                  >
                    Remove
                  </button>
                </div>
                <select
                  v-if="!store.currentRoundLocked && match.teamB.members.length < 2"
                  @change="assignFromSelect($event, match.id, 'B')"
                >
                  <option value="">Add player</option>
                  <option
                    v-for="player in unassignedPlayers"
                    :key="player.id"
                    :value="player.id"
                  >
                    #{{ player.seed }} {{ player.name }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div class="boards">
            <div
              v-for="(board, boardIndex) in getBoards(match)"
              :key="`${match.id}-${boardIndex}`"
              class="board-card"
            >
              <span>Board {{ board.boardNumber || boardIndex + 1 }}</span>
              <strong>
                {{ getPlayerName(board.whitePlayerId) }}
                vs
                {{ getPlayerName(board.blackPlayerId) }}
              </strong>
            </div>
            <p v-if="getBoards(match).length === 0" class="board-placeholder">
              Boards appear after both teams have two players.
            </p>
          </div>

          <div class="result-actions">
            <button
              type="button"
              :class="{ selected: isResultSelected(match, 1, 0) }"
              :disabled="store.currentRoundLocked"
              @click="store.setMatchResult(match.id, { teamAScore: 1, teamBScore: 0 })"
            >
              Team A Win
            </button>
            <button
              type="button"
              :class="{ selected: isResultSelected(match, 0.5, 0.5) }"
              :disabled="store.currentRoundLocked"
              @click="store.setMatchResult(match.id, { teamAScore: 0.5, teamBScore: 0.5 })"
            >
              Draw
            </button>
            <button
              type="button"
              :class="{ selected: isResultSelected(match, 0, 1) }"
              :disabled="store.currentRoundLocked"
              @click="store.setMatchResult(match.id, { teamAScore: 0, teamBScore: 1 })"
            >
              Team B Win
            </button>
          </div>

          <button
            v-if="!store.currentRoundLocked && store.currentRoundObj.strategy === 'manual'"
            type="button"
            class="remove-match"
            @click="store.removeMatch(match.id)"
          >
            Delete Match
          </button>
        </article>
      </div>

      <div
        v-if="currentRoundComplete || store.currentRoundLocked"
        class="round-footer-action"
      >
        <span>
          {{
            store.currentRoundLocked
              ? 'Round confirmed.'
              : 'All match results are entered.'
          }}
        </span>
        <button
          v-if="currentRoundComplete && !store.currentRoundLocked"
          type="button"
          class="primary"
          @click="confirmRound"
        >
          Confirm Round
        </button>
        <button
          v-else-if="store.currentRoundLocked && store.tournament.currentRound < store.tournament.totalRounds"
          type="button"
          class="primary"
          @click="startRound"
        >
          Generate Next
        </button>
        <button
          v-else-if="store.currentRoundLocked"
          type="button"
          class="secondary"
          @click="emit('go-scores')"
        >
          View Standings
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.pairings-empty,
.mobile-pairings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pairings-empty,
.pairings-header,
.round-toolbar,
.warning-list,
.empty-round,
.round-progress-card,
.manual-panel,
.round-footer-action,
.match-card {
  border: 1px solid #d7dde2;
  border-radius: 8px;
  background: #ffffff;
}

.pairings-empty,
.pairings-header,
.round-toolbar,
.empty-round,
.round-progress-card,
.manual-panel,
.round-footer-action,
.match-card {
  padding: 14px;
}

.pairings-empty h2,
.pairings-header h2,
.empty-round h3,
.match-card h3 {
  margin: 0;
  color: #17212b;
  line-height: 1.15;
}

.pairings-empty p,
.empty-round p {
  margin: 8px 0 0;
  color: #607080;
  line-height: 1.45;
}

.pairings-header,
.match-card-header,
.round-progress-card,
.manual-panel {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.eyebrow {
  display: block;
  margin-bottom: 4px;
  color: #607080;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.round-state,
.result-pill {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 6px 10px;
  background: #fff3d6;
  color: #7a5200;
  font-size: 12px;
  font-weight: 800;
}

.result-pill.done,
.round-state {
  background: #eef4f8;
  color: #2d506f;
}

.round-toolbar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.round-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.round-tab {
  min-height: 40px;
  flex: 0 0 auto;
  border: 1px solid #c8d3dc;
  border-radius: 8px;
  padding: 0 12px;
  background: #ffffff;
  color: #405264;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.round-tab.active {
  border-color: #1268b3;
  background: #eaf3fb;
  color: #1268b3;
}

.strategy-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
}

.strategy-row label {
  color: #405264;
  font-size: 13px;
  font-weight: 800;
}

.strategy-row select,
.team-members select {
  min-height: 44px;
  width: 100%;
  min-width: 0;
  border: 1px solid #b9c5cf;
  border-radius: 8px;
  padding: 8px 10px;
  background: #ffffff;
  color: #17212b;
}

.strategy-note {
  grid-column: 1 / -1;
  margin: -2px 0 0;
  color: #607080;
  font-size: 12px;
  line-height: 1.35;
}

.toolbar-actions,
.result-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.toolbar-actions button,
.result-actions button,
.manual-panel button,
.member-row button,
.remove-match {
  min-height: 44px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
}

button.primary {
  border: none;
  background: #1268b3;
  color: #ffffff;
}

button.secondary {
  border: 1px solid #c8d3dc;
  background: #ffffff;
  color: #405264;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.warning-list {
  padding: 10px 12px;
  background: #fff8e8;
}

.warning-list p {
  margin: 0;
  color: #7a5200;
  font-size: 13px;
  line-height: 1.4;
}

.round-progress-card {
  align-items: center;
  border-color: #d7dde2;
  background: #ffffff;
}

.round-progress-card.complete {
  border-color: #bddfcf;
  background: #f0faf5;
}

.round-progress-card.locked {
  border-color: #bed4e8;
  background: #f3f8fc;
}

.round-progress-card strong,
.round-progress-card span {
  display: block;
}

.round-progress-card strong {
  color: #17212b;
  font-size: 15px;
}

.round-progress-card span {
  margin-top: 4px;
  color: #607080;
  font-size: 13px;
  line-height: 1.35;
}

.round-progress-card button {
  min-height: 44px;
  flex: 0 0 auto;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
  font-weight: 800;
}

.round-footer-action {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border-color: #bddfcf;
  background: #f0faf5;
}

.round-footer-action span {
  color: #17613b;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.35;
}

.round-footer-action button {
  min-height: 44px;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
  font-weight: 800;
}

.manual-panel strong,
.manual-panel span {
  display: block;
}

.manual-panel strong {
  color: #17212b;
}

.manual-panel span {
  margin-top: 3px;
  color: #607080;
  font-size: 13px;
}

.match-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.match-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 6px 18px rgba(21, 31, 44, 0.04);
}

.result-summary {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  border: 1px dashed #c8d3dc;
  border-radius: 8px;
  padding: 10px 12px;
  background: #f8fafb;
}

.result-summary.done {
  border-style: solid;
  border-color: #bddfcf;
  background: #f0faf5;
}

.result-summary span {
  color: #17212b;
  font-size: 18px;
  font-weight: 900;
}

.result-summary strong {
  color: #607080;
  text-align: right;
  font-size: 12px;
  line-height: 1.25;
}

.teams {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team-card,
.board-card {
  border: 1px solid #e4e9ee;
  border-radius: 8px;
  background: #f8fafb;
}

.team-card {
  padding: 12px;
}

.team-title {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: #17212b;
  font-size: 14px;
}

.team-title span {
  color: #607080;
  font-size: 12px;
  font-weight: 800;
}

.team-members {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.member-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  color: #17212b;
  font-size: 14px;
}

.member-row span:nth-child(2) {
  min-width: 0;
  overflow-wrap: anywhere;
}

.member-row button {
  min-height: 34px;
  border: 1px solid #e0b9b9;
  background: #ffffff;
  color: #9b2727;
  font-size: 12px;
}

.color-dot {
  width: 12px;
  height: 12px;
  border: 1px solid #9aa8b5;
  border-radius: 50%;
}

.color-dot.white {
  background: #ffffff;
}

.color-dot.black {
  background: #17212b;
}

.versus {
  color: #607080;
  text-align: center;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
}

.boards {
  display: grid;
  gap: 8px;
}

.board-card {
  padding: 10px;
}

.board-card span {
  display: block;
  margin-bottom: 4px;
  color: #607080;
  font-size: 12px;
  font-weight: 800;
}

.board-card strong {
  display: block;
  overflow-wrap: anywhere;
  color: #17212b;
  font-size: 14px;
  line-height: 1.35;
}

.board-placeholder {
  margin: 0;
  border: 1px dashed #c8d3dc;
  border-radius: 8px;
  padding: 12px;
  color: #607080;
  text-align: center;
  font-size: 13px;
}

.result-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.result-actions button {
  border: 1px solid #c8d3dc;
  padding: 0 6px;
  background: #ffffff;
  color: #405264;
  font-size: 12px;
}

.result-actions button.selected {
  border-color: #1268b3;
  background: #1268b3;
  color: #ffffff;
}

.remove-match {
  border: 1px solid #e0b9b9;
  background: #ffffff;
  color: #9b2727;
}

@media (min-width: 760px) {
  .match-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
