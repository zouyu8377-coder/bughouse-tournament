<script setup lang="ts">
import { computed } from 'vue';
import { useTournamentStatus } from './useTournamentStatus';

const emit = defineEmits<{
  (event: 'navigate', target: 'setup' | 'pairing' | 'scores'): void;
}>();

const {
  store,
  playerCount,
  currentRoundNumber,
  totalRounds,
  completedMatches,
  totalMatches,
  status,
  statusLabel,
  nextAction,
} = useTournamentStatus();

const tournamentName = computed(() => store.tournament?.name ?? 'Bughouse Tournament');

const roundLabel = computed(() => {
  if (!store.tournament) return 'No tournament yet';
  if (currentRoundNumber.value === 0) return `0 / ${totalRounds.value}`;
  return `${currentRoundNumber.value} / ${totalRounds.value}`;
});

const completionLabel = computed(() => {
  if (totalMatches.value === 0) return 'No active round';
  return `${completedMatches.value} of ${totalMatches.value} matches complete`;
});

function runPrimaryAction() {
  if (nextAction.value.action === 'startRound') {
    if (store.currentRoundObj && !store.currentRoundLocked) {
      store.lockCurrentRound();
    }
    if (store.currentRoundObj && !store.currentRoundLocked) {
      emit('navigate', nextAction.value.target);
      return;
    }
    store.startNewRound();
  }
  emit('navigate', nextAction.value.target);
}
</script>

<template>
  <section class="mobile-dashboard" aria-label="Tournament dashboard">
    <div class="dashboard-kicker">Organizer Dashboard</div>
    <div class="dashboard-title-row">
      <div>
        <h2>{{ tournamentName }}</h2>
        <p>{{ statusLabel }}</p>
      </div>
      <span class="status-pill" :data-status="status">{{ statusLabel }}</span>
    </div>

    <div class="metric-grid">
      <div class="metric">
        <span class="metric-label">Round</span>
        <strong>{{ roundLabel }}</strong>
      </div>
      <div class="metric">
        <span class="metric-label">Players</span>
        <strong>{{ playerCount }}</strong>
      </div>
      <div class="metric wide">
        <span class="metric-label">Current round</span>
        <strong>{{ completionLabel }}</strong>
      </div>
    </div>

    <button class="primary-action" type="button" @click="runPrimaryAction">
      {{ nextAction.label }}
    </button>
  </section>
</template>

<style scoped>
.mobile-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  background: #ffffff;
  border: 1px solid #d7dde2;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(21, 31, 44, 0.06);
}

.dashboard-kicker {
  color: #607080;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.dashboard-title-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.dashboard-title-row h2 {
  margin: 0;
  color: #17212b;
  font-size: 22px;
  line-height: 1.15;
}

.dashboard-title-row p {
  margin: 6px 0 0;
  color: #607080;
  font-size: 14px;
}

.status-pill {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 6px 10px;
  background: #eef4f8;
  color: #2d506f;
  font-size: 12px;
  font-weight: 700;
}

.status-pill[data-status='in_progress'] {
  background: #fff3d6;
  color: #7a5200;
}

.status-pill[data-status='completed'] {
  background: #dff5ea;
  color: #17613b;
}

.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.metric {
  min-width: 0;
  padding: 12px;
  border-radius: 8px;
  background: #f6f8fa;
  border: 1px solid #e4e9ee;
}

.metric.wide {
  grid-column: 1 / -1;
}

.metric-label {
  display: block;
  margin-bottom: 4px;
  color: #607080;
  font-size: 12px;
  font-weight: 700;
}

.metric strong {
  display: block;
  color: #17212b;
  font-size: 18px;
  line-height: 1.2;
}

.primary-action {
  min-height: 48px;
  width: 100%;
  border: none;
  border-radius: 8px;
  background: #1268b3;
  color: #ffffff;
  cursor: pointer;
  font: inherit;
  font-size: 16px;
  font-weight: 800;
}

.primary-action:active {
  transform: translateY(1px);
}

@media (min-width: 760px) {
  .mobile-dashboard {
    padding: 22px;
  }

  .metric-grid {
    grid-template-columns: 1fr 1fr 1.4fr;
  }

  .metric.wide {
    grid-column: auto;
  }
}
</style>
