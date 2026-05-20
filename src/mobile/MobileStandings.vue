<script setup lang="ts">
import { computed } from 'vue';
import { useTournamentStore } from '../stores/tournament';

const store = useTournamentStore();

const standings = computed(() =>
  store.sortedPlayers.map((player, index) => ({
    rank: index + 1,
    ...player,
  }))
);

const topThree = computed(() => standings.value.slice(0, 3));
const champion = computed(() => topThree.value[0]);
const runnerUp = computed(() => topThree.value[1]);
const thirdPlace = computed(() => topThree.value[2]);

const isFinished = computed(() => {
  const tournament = store.tournament;
  if (!tournament || tournament.rounds.length < tournament.totalRounds) return false;
  return tournament.rounds.every((round) => round.locked);
});

const completedRounds = computed(() => {
  return store.tournament?.rounds.filter((round) => round.locked).length ?? 0;
});

const standingsHeading = computed(() => (isFinished.value ? 'Final Ranking' : 'Live Ranking'));

const roundNumbers = computed(() => {
  const tournament = store.tournament;
  if (!tournament) return [];
  return Array.from({ length: tournament.totalRounds }, (_, index) => index + 1);
});

function formatScore(score: number | undefined) {
  if (score === undefined) return '';
  if (score === 0.5) return '0.5';
  return `${score}`;
}

function getPlayerRoundInfo(playerId: string, roundNumber: number): { score: string; color: string } {
  if (!store.tournament) return { score: '', color: '' };
  const round = store.tournament.rounds.find((item) => item.roundNumber === roundNumber);
  if (!round) return { score: '', color: '' };

  for (const match of round.matches) {
    const inA = match.teamA.members.find((member) => member.playerId === playerId);
    const inB = match.teamB.members.find((member) => member.playerId === playerId);

    if (inA) {
      return {
        score: formatScore(match.result?.teamAScore),
        color: inA.color === 'white' ? 'W' : 'B',
      };
    }

    if (inB) {
      return {
        score: formatScore(match.result?.teamBScore),
        color: inB.color === 'white' ? 'W' : 'B',
      };
    }
  }

  return { score: '', color: '' };
}
</script>

<template>
  <section v-if="!store.tournament" class="standings-empty">
    <h2>Create a tournament first</h2>
    <p>Standings appear after players and round results are available.</p>
  </section>

  <section v-else class="mobile-standings">
    <header class="standings-header">
      <div>
        <span class="eyebrow">Standings</span>
        <h2>{{ isFinished ? 'Final Standings' : 'Live Standings' }}</h2>
      </div>
      <span class="state-pill">
        {{ completedRounds }} / {{ store.tournament.totalRounds }} rounds
      </span>
    </header>

    <section v-if="topThree.length" class="podium" :class="{ complete: isFinished }">
      <div class="podium-heading">
        <span class="eyebrow">{{ isFinished ? 'Tournament Completed' : 'Current Leaders' }}</span>
        <h3>{{ isFinished ? 'Final Podium' : champion?.name }}</h3>
        <p v-if="champion">
          {{
            isFinished
              ? `${store.tournament.name} is complete after ${store.tournament.totalRounds} rounds.`
              : `Leader with ${champion.score} points`
          }}
        </p>
      </div>

      <div v-if="isFinished && champion" class="champion-card">
        <span>Champion</span>
        <strong>{{ champion.name }}</strong>
        <small>{{ champion.score }} pts</small>
      </div>

      <div class="podium-list" :class="{ complete: isFinished }">
        <article v-if="runnerUp" class="podium-place rank-2">
          <span>#2</span>
          <strong>{{ runnerUp.name }}</strong>
          <small>{{ runnerUp.score }} pts</small>
        </article>

        <article v-if="!isFinished && champion" class="podium-place rank-1">
          <span>#1</span>
          <strong>{{ champion.name }}</strong>
          <small>{{ champion.score }} pts</small>
        </article>

        <article v-if="thirdPlace" class="podium-place rank-3">
          <span>#3</span>
          <strong>{{ thirdPlace.name }}</strong>
          <small>{{ thirdPlace.score }} pts</small>
        </article>
      </div>
    </section>

    <div class="ranking-divider">
      <span>{{ standingsHeading }}</span>
      <strong>{{ standings.length }} players</strong>
    </div>

    <div class="standing-list">
      <article v-for="row in standings" :key="row.id" class="standing-card">
        <div class="standing-main">
          <div class="rank-badge">#{{ row.rank }}</div>
          <div class="player-copy">
            <h3>{{ row.name }}</h3>
            <p>Seed {{ row.seed }}</p>
          </div>
          <div class="score-block">
            <span>Score</span>
            <strong>{{ row.score }}</strong>
          </div>
        </div>

        <div class="tie-break-grid">
          <div>
            <span>Buchholz</span>
            <strong>{{ row.buchholz }}</strong>
          </div>
          <div>
            <span>Progressive</span>
            <strong>{{ row.progressive }}</strong>
          </div>
          <div>
            <span>S-B</span>
            <strong>{{ row.sonnebornBerger }}</strong>
          </div>
        </div>

        <details class="round-details">
          <summary>Round scores</summary>
          <div class="round-score-grid">
            <div v-for="roundNumber in roundNumbers" :key="roundNumber" class="round-score">
              <span>R{{ roundNumber }}</span>
              <strong>
                {{ getPlayerRoundInfo(row.id, roundNumber).score || '-' }}
                <small>{{ getPlayerRoundInfo(row.id, roundNumber).color }}</small>
              </strong>
            </div>
          </div>
        </details>
      </article>
    </div>
  </section>
</template>

<style scoped>
.standings-empty,
.mobile-standings {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.standings-empty,
.standings-header,
.podium,
.ranking-divider,
.standing-card {
  border: 1px solid #d7dde2;
  border-radius: 8px;
  background: #ffffff;
}

.standings-empty,
.standings-header,
.podium,
.ranking-divider,
.standing-card {
  padding: 14px;
}

.standings-empty h2,
.standings-header h2,
.podium-heading h3,
.standing-card h3 {
  margin: 0;
  color: #17212b;
  line-height: 1.15;
}

.standings-empty p {
  margin: 8px 0 0;
  color: #607080;
  line-height: 1.45;
}

.standings-header {
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

.state-pill {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 6px 10px;
  background: #eef4f8;
  color: #2d506f;
  font-size: 12px;
  font-weight: 800;
}

.podium {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-color: #d6c47a;
  background: #fffaf0;
}

.podium.complete {
  border-color: #c9a84f;
  background: linear-gradient(180deg, #fff7df 0%, #ffffff 100%);
}

.podium-heading h3 {
  font-size: 26px;
}

.podium-heading p {
  margin: 6px 0 0;
  color: #6d5b22;
  font-size: 14px;
  line-height: 1.35;
}

.champion-card {
  border-radius: 8px;
  padding: 18px 14px;
  background: #f4c95d;
  text-align: center;
  box-shadow: inset 0 -12px 0 rgba(109, 91, 34, 0.08);
}

.champion-card span,
.champion-card small {
  display: block;
  color: #6d5b22;
  font-weight: 900;
}

.champion-card span {
  font-size: 12px;
  text-transform: uppercase;
}

.champion-card strong {
  display: block;
  margin: 8px 0 6px;
  overflow-wrap: anywhere;
  color: #17212b;
  font-size: 28px;
  line-height: 1.05;
}

.champion-card small {
  font-size: 14px;
}

.podium-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.podium-list.complete {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.podium-place {
  min-width: 0;
  border-radius: 8px;
  padding: 12px 8px;
  text-align: center;
}

.podium-place.rank-1 {
  background: #f7d879;
}

.podium-place.rank-2 {
  background: #e4e8ec;
}

.podium-place.rank-3 {
  background: #e8c09a;
}

.podium-place span,
.podium-place small {
  display: block;
  font-weight: 800;
}

.podium-place span {
  color: #6d5b22;
  font-size: 12px;
}

.podium-place strong {
  display: block;
  margin: 5px 0;
  overflow-wrap: anywhere;
  color: #17212b;
  font-size: 14px;
  line-height: 1.2;
}

.podium-place small {
  color: #405264;
  font-size: 12px;
}

.ranking-divider {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  background: #ffffff;
}

.ranking-divider span {
  color: #17212b;
  font-size: 15px;
  font-weight: 900;
}

.ranking-divider strong {
  flex: 0 0 auto;
  color: #607080;
  font-size: 12px;
  font-weight: 800;
}

.standing-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.standing-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 6px 18px rgba(21, 31, 44, 0.04);
}

.standing-main {
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
  overflow-wrap: anywhere;
  font-size: 17px;
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
  font-size: 24px;
  line-height: 1;
}

.tie-break-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.tie-break-grid div,
.round-score {
  min-width: 0;
  border-radius: 8px;
  background: #f6f8fa;
  padding: 8px 6px;
  text-align: center;
}

.tie-break-grid span,
.round-score span {
  display: block;
  color: #607080;
  font-size: 11px;
  font-weight: 800;
}

.tie-break-grid strong,
.round-score strong {
  display: block;
  margin-top: 3px;
  color: #17212b;
  font-size: 14px;
}

.round-details {
  border-top: 1px solid #e4e9ee;
  padding-top: 10px;
}

.round-details summary {
  min-height: 36px;
  color: #405264;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}

.round-score-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}

.round-score small {
  margin-left: 2px;
  color: #607080;
  font-size: 10px;
}

@media (min-width: 760px) {
  .standing-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
