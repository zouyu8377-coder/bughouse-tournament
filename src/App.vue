<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTournamentStore } from './stores/tournament';
import TournamentSetup from './components/TournamentSetup.vue';
import MobileDashboard from './mobile/MobileDashboard.vue';
import MobilePairings from './mobile/MobilePairings.vue';
import MobilePlayers from './mobile/MobilePlayers.vue';
import MobileStandings from './mobile/MobileStandings.vue';

type AppView = 'dashboard' | 'setup' | 'players' | 'pairing' | 'scores';

const store = useTournamentStore();
const activeView = ref<AppView>('dashboard');
const appVersion = __APP_VERSION__;

const hasTournament = computed(() => !!store.tournament);
const navItems = computed(() => {
  const items: { key: AppView; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'setup', label: hasTournament.value ? 'Setup' : 'Create' },
  ];

  if (hasTournament.value) {
    items.push(
      { key: 'players', label: 'Players' },
      { key: 'pairing', label: 'Pairings' },
      { key: 'scores', label: 'Standings' }
    );
  }

  return items;
});

function navigate(target: AppView) {
  activeView.value = target;
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand-block">
        <span class="eyebrow">Mobile MVP</span>
        <div class="title-row">
          <h1>Bughouse Tournament</h1>
          <span class="version-badge">v{{ appVersion }}</span>
        </div>
      </div>
    </header>

    <main class="app-main">
      <div v-if="store.error" class="error-bar" @click="store.clearError()">
        {{ store.error }}
      </div>

      <MobileDashboard
        v-if="activeView === 'dashboard'"
        @navigate="navigate"
      />

      <TournamentSetup
        v-else-if="activeView === 'setup'"
        @created="activeView = 'dashboard'"
      />

      <MobilePlayers v-else-if="activeView === 'players'" />

      <MobilePairings
        v-else-if="activeView === 'pairing'"
        @go-scores="activeView = 'scores'"
      />

      <MobileStandings v-else-if="activeView === 'scores'" />
    </main>

    <nav class="bottom-nav" aria-label="Primary navigation">
      <button
        v-for="item in navItems"
        :key="item.key"
        :class="['nav-item', { active: activeView === item.key }]"
        type="button"
        @click="activeView = item.key"
      >
        {{ item.label }}
      </button>
    </nav>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

html {
  min-width: 0;
  background: #eef2f5;
}

body {
  min-width: 0;
  margin: 0;
  overflow-x: hidden;
  background: #eef2f5;
  color: #17212b;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

button,
input,
select {
  font: inherit;
}

button {
  touch-action: manipulation;
}

.app-shell {
  width: 100%;
  max-width: 760px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 16px 12px 88px;
}

.app-header {
  padding: 6px 2px 14px;
}

.brand-block {
  min-width: 0;
}

.eyebrow {
  display: block;
  margin-bottom: 4px;
  color: #607080;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.title-row h1 {
  min-width: 0;
  margin: 0;
  color: #17212b;
  font-size: 24px;
  line-height: 1.12;
}

.version-badge {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 7px;
  background: #dbe5ed;
  color: #405264;
  font-size: 11px;
  font-weight: 800;
}

.app-main {
  min-width: 0;
}

.error-bar {
  margin-bottom: 12px;
  border-radius: 8px;
  padding: 12px 14px;
  background: #ba3434;
  color: #ffffff;
  cursor: pointer;
  font-size: 14px;
  line-height: 1.4;
}

.bottom-nav {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 8px max(10px, env(safe-area-inset-right)) calc(8px + env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
  border-top: 1px solid #d7dde2;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -8px 22px rgba(21, 31, 44, 0.08);
  backdrop-filter: blur(12px);
}

.nav-item {
  min-height: 44px;
  max-width: 150px;
  flex: 1 1 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: #607080;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.nav-item.active {
  border-color: #bed4e8;
  background: #eaf3fb;
  color: #1268b3;
}

@media (min-width: 760px) {
  .app-shell {
    max-width: 1040px;
    padding: 24px 20px 104px;
  }

  .title-row h1 {
    font-size: 30px;
  }

  .bottom-nav {
    left: 50%;
    width: min(720px, calc(100% - 32px));
    bottom: 16px;
    transform: translateX(-50%);
    border: 1px solid #d7dde2;
    border-radius: 14px;
  }
}
</style>
