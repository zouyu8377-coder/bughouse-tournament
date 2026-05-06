<script setup lang="ts">
import { computed } from 'vue';
import { useTournamentStore } from '../stores/tournament';

const store = useTournamentStore();

const standings = computed(() => {
  return store.sortedPlayers.map((p, i) => ({
    rank: i + 1,
    ...p,
  }));
});

const topThree = computed(() => standings.value.slice(0, 3));

const roundNumbers = computed(() => {
  const t = store.tournament;
  if (!t) return [];
  const arr: number[] = [];
  for (let i = 1; i <= t.totalRounds; i++) arr.push(i);
  return arr;
});

const isFinished = computed(() => {
  const t = store.tournament;
  if (!t || t.rounds.length < t.totalRounds) return false;
  return t.rounds.every((r) => r.locked);
});

function getPlayerRoundInfo(playerId: string, roundNum: number): { score: string; color: string } {
  if (!store.tournament) return { score: '', color: '' };
  const round = store.tournament.rounds.find((r) => r.roundNumber === roundNum);
  if (!round) return { score: '', color: '' };

  for (const match of round.matches) {
    const inA = match.teamA.members.find((m) => m.playerId === playerId);
    const inB = match.teamB.members.find((m) => m.playerId === playerId);

    if (inA) {
      const sc = match.result ? match.result.teamAScore : undefined;
      const scoreStr = sc === undefined ? '' : sc === 1 ? '1' : sc === 0.5 ? '½' : '0';
      return { score: scoreStr, color: inA.color === 'white' ? 'W' : 'B' };
    }
    if (inB) {
      const sc = match.result ? match.result.teamBScore : undefined;
      const scoreStr = sc === undefined ? '' : sc === 1 ? '1' : sc === 0.5 ? '½' : '0';
      return { score: scoreStr, color: inB.color === 'white' ? 'W' : 'B' };
    }
  }
  return { score: '', color: '' };
}
</script>

<template>
  <div>
    <div v-if="isFinished && topThree.length" class="podium">
      <h2>比赛结束 🏆</h2>
      <div class="podium-stage">
        <div
          v-if="topThree[1]"
          class="podium-place silver"
        >
          <div class="medal">2</div>
          <div class="name">{{ topThree[1].name }}</div>
          <div class="score">{{ topThree[1].score }} 分</div>
        </div>

        <div
          v-if="topThree[0]"
          class="podium-place gold"
        >
          <div class="medal">1</div>
          <div class="name">{{ topThree[0].name }}</div>
          <div class="score">{{ topThree[0].score }} 分</div>
        </div>

        <div
          v-if="topThree[2]"
          class="podium-place bronze"
        >
          <div class="medal">3</div>
          <div class="name">{{ topThree[2].name }}</div>
          <div class="score">{{ topThree[2].score }} 分</div>
        </div>
      </div>
    </div>

    <h2>积分榜</h2>
    <table class="scoreboard">
      <thead>
        <tr>
          <th class="col-left">排名</th>
          <th class="col-left">姓名</th>
          <th class="col-left">序号</th>
          <th v-for="rn in roundNumbers" :key="rn">第{{ rn }}轮</th>
          <th class="col-right compact">积分</th>
          <th class="col-right compact">对手分</th>
          <th class="col-right compact">累进分</th>
          <th class="col-right compact">索博分</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in standings" :key="row.id">
          <td class="col-left">{{ row.rank }}</td>
          <td class="col-left">{{ row.name }}</td>
          <td class="col-left">{{ row.seed }}</td>
          <td v-for="rn in roundNumbers" :key="rn" class="round-cell">
            <span v-if="getPlayerRoundInfo(row.id, rn).score !== ''">
              {{ getPlayerRoundInfo(row.id, rn).score }}<span class="color-label">{{ getPlayerRoundInfo(row.id, rn).color }}</span>
            </span>
          </td>
          <td class="col-right compact highlight">{{ row.score }}</td>
          <td class="col-right compact">{{ row.buchholz }}</td>
          <td class="col-right compact">{{ row.progressive }}</td>
          <td class="col-right compact">{{ row.sonnebornBerger }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.scoreboard {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.scoreboard th,
.scoreboard td {
  padding: 8px 10px;
  text-align: center;
  border-bottom: 1px solid #dfe6e9;
}

.scoreboard th {
  background: #f8f9fa;
  font-weight: 600;
  color: #636e72;
  font-size: 11px;
  white-space: nowrap;
}

.scoreboard .col-left {
  text-align: left;
}

.scoreboard .col-right {
  text-align: center;
}

.scoreboard .compact {
  padding: 8px 4px;
  min-width: 48px;
}

.scoreboard tr:hover td {
  background: #f8f9fa;
}

.highlight {
  font-weight: 700;
  color: #0984e3;
}

.round-cell {
  white-space: nowrap;
}

.color-label {
  font-size: 10px;
  color: #636e72;
  margin-left: 2px;
}

.podium {
  background: linear-gradient(135deg, #fff9c4 0%, #fffde7 100%);
  border: 2px solid #fbc02d;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  text-align: center;
}

.podium h2 {
  margin: 0 0 16px;
  font-size: 20px;
  color: #f57f17;
}

.podium-stage {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 16px;
}

.podium-place {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  border-radius: 8px;
  min-width: 120px;
}

.podium-place.gold {
  background: #fff176;
  order: 2;
  transform: scale(1.1);
  padding-bottom: 24px;
}

.podium-place.silver {
  background: #e0e0e0;
  order: 1;
}

.podium-place.bronze {
  background: #ffcc80;
  order: 3;
}

.medal {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 8px;
  color: white;
}

.gold .medal {
  background: #f9a825;
}

.silver .medal {
  background: #9e9e9e;
}

.bronze .medal {
  background: #ef6c00;
}

.podium-place .name {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
}

.podium-place .score {
  font-size: 13px;
  color: #555;
}
</style>
