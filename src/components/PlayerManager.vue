<script setup lang="ts">
import { computed } from 'vue';
import { useTournamentStore } from '../stores/tournament';

const store = useTournamentStore();

const players = computed(() => store.sortedPlayers);
</script>

<template>
  <div>
    <h2>选手列表（按积分排序）</h2>
    <table class="table">
      <thead>
        <tr>
          <th>排名</th>
          <th>姓名</th>
          <th>序号</th>
          <th>积分</th>
          <th>对手分</th>
          <th>累进分</th>
          <th>索博分</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(p, i) in players" :key="p.id">
          <td>{{ i + 1 }}</td>
          <td>{{ p.name }}</td>
          <td>{{ p.seed }}</td>
          <td>{{ p.score }}</td>
          <td>{{ p.buchholz }}</td>
          <td>{{ p.progressive }}</td>
          <td>{{ p.sonnebornBerger }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.table th,
.table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #dfe6e9;
}

.table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #636e72;
  font-size: 12px;
  text-transform: uppercase;
}

.table tr:hover td {
  background: #f8f9fa;
}
</style>
