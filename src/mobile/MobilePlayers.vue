<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTournamentStore } from '../stores/tournament';

const store = useTournamentStore();

const newPlayerName = ref('');
const editingPlayerId = ref<string | null>(null);
const editingName = ref('');

const players = computed(() =>
  [...store.playersWithScores].sort((a, b) => a.seed - b.seed)
);

const canChangeRoster = computed(() => !!store.tournament && !store.tournamentStarted);

function addPlayer() {
  const name = newPlayerName.value.trim();
  if (!name) return;
  store.addPlayer(name);
  newPlayerName.value = '';
}

function startEditing(playerId: string, name: string) {
  editingPlayerId.value = playerId;
  editingName.value = name;
}

function saveEditing() {
  if (!editingPlayerId.value) return;
  store.renamePlayer(editingPlayerId.value, editingName.value);
  editingPlayerId.value = null;
  editingName.value = '';
}

function cancelEditing() {
  editingPlayerId.value = null;
  editingName.value = '';
}
</script>

<template>
  <section v-if="!store.tournament" class="players-empty">
    <h2>Create a tournament first</h2>
    <p>Players are managed inside a tournament so seeds, scores, and standings stay together.</p>
  </section>

  <section v-else class="mobile-players">
    <header class="section-header">
      <div>
        <span class="eyebrow">Players</span>
        <h2>{{ players.length }} registered</h2>
      </div>
      <span class="roster-state">{{ canChangeRoster ? 'Roster open' : 'Round history locked' }}</span>
    </header>

    <form v-if="canChangeRoster" class="add-player" @submit.prevent="addPlayer">
      <label for="new-player-name">Add player</label>
      <div class="add-row">
        <input
          id="new-player-name"
          v-model="newPlayerName"
          autocomplete="off"
          maxlength="40"
          placeholder="Player name"
        />
        <button type="submit">Add</button>
      </div>
    </form>

    <p v-else class="locked-note">
      Names can still be edited, but adding, deleting, and reseeding are disabled after pairings exist.
    </p>

    <div class="player-list" aria-label="Player list">
      <article v-for="(player, index) in players" :key="player.id" class="player-card">
        <div class="player-main">
          <div class="rank-badge">#{{ player.seed }}</div>
          <div class="player-copy">
            <template v-if="editingPlayerId === player.id">
              <input
                v-model="editingName"
                class="edit-input"
                autocomplete="off"
                maxlength="40"
                @keyup.enter="saveEditing"
                @keyup.escape="cancelEditing"
              />
            </template>
            <template v-else>
              <h3>{{ player.name }}</h3>
              <p>Seed {{ player.seed }}</p>
            </template>
          </div>
          <div class="score-block">
            <span>Score</span>
            <strong>{{ player.score }}</strong>
          </div>
        </div>

        <div class="tie-breaks">
          <span>BH {{ player.buchholz }}</span>
          <span>Prog {{ player.progressive }}</span>
          <span>SB {{ player.sonnebornBerger }}</span>
        </div>

        <div class="player-actions">
          <template v-if="editingPlayerId === player.id">
            <button type="button" class="secondary" @click="cancelEditing">Cancel</button>
            <button type="button" class="primary" @click="saveEditing">Save</button>
          </template>

          <template v-else>
            <button type="button" class="secondary" @click="startEditing(player.id, player.name)">
              Edit
            </button>
            <button
              type="button"
              class="secondary"
              :disabled="!canChangeRoster || index === 0"
              @click="store.movePlayerSeed(player.id, 'up')"
            >
              Up
            </button>
            <button
              type="button"
              class="secondary"
              :disabled="!canChangeRoster || index === players.length - 1"
              @click="store.movePlayerSeed(player.id, 'down')"
            >
              Down
            </button>
            <button
              type="button"
              class="danger"
              :disabled="!canChangeRoster"
              @click="store.removePlayer(player.id)"
            >
              Delete
            </button>
          </template>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.players-empty,
.mobile-players {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.players-empty,
.section-header,
.add-player,
.locked-note,
.player-card {
  border: 1px solid #d7dde2;
  border-radius: 8px;
  background: #ffffff;
}

.players-empty,
.section-header {
  padding: 18px;
}

.players-empty h2,
.section-header h2 {
  margin: 0;
  color: #17212b;
  font-size: 22px;
  line-height: 1.15;
}

.players-empty p {
  margin: 0;
  color: #607080;
  line-height: 1.45;
}

.section-header {
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

.roster-state {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 6px 10px;
  background: #eef4f8;
  color: #2d506f;
  font-size: 12px;
  font-weight: 800;
}

.add-player,
.locked-note {
  padding: 14px;
}

.add-player label {
  display: block;
  margin-bottom: 8px;
  color: #405264;
  font-size: 13px;
  font-weight: 800;
}

.add-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.add-row input,
.edit-input {
  min-height: 44px;
  width: 100%;
  min-width: 0;
  border: 1px solid #b9c5cf;
  border-radius: 8px;
  padding: 9px 11px;
  color: #17212b;
  background: #ffffff;
  font-size: 16px;
}

.add-row button,
.player-actions button {
  min-height: 44px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 800;
}

.add-row button {
  border: none;
  padding: 0 16px;
  background: #1268b3;
  color: #ffffff;
}

.locked-note {
  margin: 0;
  color: #607080;
  font-size: 14px;
  line-height: 1.45;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.player-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  box-shadow: 0 6px 18px rgba(21, 31, 44, 0.04);
}

.player-main {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
}

.rank-badge {
  display: grid;
  place-items: center;
  min-width: 42px;
  height: 42px;
  border-radius: 8px;
  background: #eaf3fb;
  color: #1268b3;
  font-size: 14px;
  font-weight: 900;
}

.player-copy {
  min-width: 0;
}

.player-copy h3 {
  margin: 0;
  overflow-wrap: anywhere;
  color: #17212b;
  font-size: 17px;
  line-height: 1.2;
}

.player-copy p {
  margin: 4px 0 0;
  color: #607080;
  font-size: 13px;
}

.score-block {
  text-align: right;
}

.score-block span {
  display: block;
  color: #607080;
  font-size: 11px;
  font-weight: 800;
}

.score-block strong {
  display: block;
  color: #17212b;
  font-size: 22px;
  line-height: 1;
}

.tie-breaks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.tie-breaks span {
  min-width: 0;
  border-radius: 8px;
  padding: 7px 6px;
  background: #f6f8fa;
  color: #405264;
  text-align: center;
  font-size: 12px;
  font-weight: 800;
}

.player-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.player-actions button {
  border: 1px solid #c8d3dc;
  padding: 0 8px;
  background: #ffffff;
  color: #405264;
  font-size: 12px;
}

.player-actions button.primary {
  border-color: #1268b3;
  background: #1268b3;
  color: #ffffff;
}

.player-actions button.danger {
  border-color: #e0b9b9;
  color: #9b2727;
}

.player-actions button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (min-width: 760px) {
  .player-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
