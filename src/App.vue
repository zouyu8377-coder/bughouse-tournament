<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTournamentStore } from './stores/tournament';
import TournamentSetup from './components/TournamentSetup.vue';
import PlayerManager from './components/PlayerManager.vue';
import PairingBoard from './components/PairingBoard.vue';
import Scoreboard from './components/Scoreboard.vue';

const store = useTournamentStore();
const activeTab = ref<'setup' | 'players' | 'pairing' | 'scores'>('setup');

const hasTournament = computed(() => !!store.tournament);
const tabs = computed(() => {
  const base = [
    { key: 'setup' as const, label: '比赛设置' },
  ];
  if (hasTournament.value) {
    base.push(
      { key: 'players' as const, label: '选手管理' },
      { key: 'pairing' as const, label: '编排' },
      { key: 'scores' as const, label: '积分榜' }
    );
  }
  return base;
});
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>Bughouse 比赛编排系统</h1>
      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          :class="['tab', { active: activeTab === tab.key }]"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>
    </header>

    <main class="main">
      <div v-if="store.error" class="error-bar" @click="store.clearError()">
        {{ store.error }}
      </div>

      <TournamentSetup
        v-if="activeTab === 'setup'"
        @created="activeTab = 'players'"
      />

      <PlayerManager v-else-if="activeTab === 'players'" />

      <PairingBoard
        v-else-if="activeTab === 'pairing'"
        @go-scores="activeTab = 'scores'"
      />

      <Scoreboard v-else-if="activeTab === 'scores'" />
    </main>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f6fa;
  color: #2d3436;
}

.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
}

.header {
  margin-bottom: 16px;
}

.header h1 {
  margin: 0 0 12px;
  font-size: 22px;
}

.tabs {
  display: flex;
  gap: 4px;
}

.tab {
  padding: 8px 16px;
  border: none;
  background: #dfe6e9;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  font-size: 14px;
}

.tab.active {
  background: #fff;
  font-weight: 600;
}

.main {
  background: #fff;
  border-radius: 0 8px 8px 8px;
  padding: 16px;
  min-height: 500px;
}

.error-bar {
  background: #ff7675;
  color: white;
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 12px;
  cursor: pointer;
}
</style>
