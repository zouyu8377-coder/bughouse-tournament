<script setup lang="ts">
import { ref, computed } from 'vue';
import { useTournamentStore } from '../stores/tournament';
import AlertModal from './AlertModal.vue';

const emit = defineEmits<{ (e: 'created'): void }>();
const store = useTournamentStore();

const name = ref('');
const totalRounds = ref(5);
const savedTournaments = ref<Awaited<ReturnType<typeof store.listTournaments>>>([]);

const alertVisible = ref(false);
const alertMessage = ref('');

function showAlert(msg: string) {
  alertMessage.value = msg;
  alertVisible.value = true;
}

async function refreshList() {
  savedTournaments.value = await store.listTournaments();
}
refreshList();

// 默认提供 8 个空行方便输入
const players = ref<{ name: string }[]>(
  Array.from({ length: 8 }, () => ({ name: '' }))
);

const validPlayers = computed(() =>
  players.value
    .map((p, i) => ({ name: p.name.trim(), seed: i + 1 }))
    .filter((p) => p.name.length > 0)
);

const dragIndex = ref<number | null>(null);

function onDragStart(index: number) {
  dragIndex.value = index;
}

function onDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return;
  const item = players.value.splice(dragIndex.value, 1)[0];
  players.value.splice(targetIndex, 0, item);
  dragIndex.value = null;
}

function moveUp(index: number) {
  if (index <= 0) return;
  const tmp = players.value[index];
  players.value[index] = players.value[index - 1];
  players.value[index - 1] = tmp;
}

function moveDown(index: number) {
  if (index >= players.value.length - 1) return;
  const tmp = players.value[index];
  players.value[index] = players.value[index + 1];
  players.value[index + 1] = tmp;
}

function removePlayer(index: number) {
  players.value.splice(index, 1);
}

function addPlayer() {
  if (players.value.length >= 64) return;
  players.value.push({ name: '' });
}

async function create() {
  const nameTrimmed = name.value.trim();
  if (!nameTrimmed) {
    showAlert('请输入比赛名称');
    return;
  }
  if (validPlayers.value.length === 0) {
    showAlert('请至少输入一位选手姓名');
    return;
  }
  if (validPlayers.value.length < 4) {
    showAlert('Bughouse 比赛至少需要 4 位选手');
    return;
  }
  if (validPlayers.value.length > 64) {
    showAlert('选手人数不能超过 64 人');
    return;
  }
  await store.createTournament(nameTrimmed, validPlayers.value, totalRounds.value);
  emit('created');
}

async function load(id: string) {
  await store.load(id);
  emit('created');
}

async function remove(id: string) {
  await store.removeTournament(id);
  refreshList();
}
</script>

<template>
  <div class="setup">
    <div class="panel">
      <h2>新建比赛</h2>
      <div class="field">
        <label>比赛名称</label>
        <input v-model="name" placeholder="输入比赛名称" />
      </div>
      <div class="field">
        <label>总轮次</label>
        <input v-model.number="totalRounds" type="number" min="1" max="20" />
      </div>

      <div class="field">
        <label>选手名单（序号即种子号，可拖拽调整顺序）</label>
        <table class="player-table">
          <thead>
            <tr>
              <th>种子</th>
              <th>姓名</th>
              <th style="width: 120px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(p, i) in players"
              :key="i"
              draggable="true"
              @dragstart="onDragStart(i)"
              @dragover.prevent
              @drop.prevent="onDrop(i)"
              class="player-row"
            >
              <td class="seed-cell">{{ i + 1 }}</td>
              <td>
                <input v-model="p.name" class="name-input" placeholder="输入姓名" />
              </td>
              <td class="actions-cell">
                <button class="btn-icon" @click="moveUp(i)" :disabled="i === 0">↑</button>
                <button class="btn-icon" @click="moveDown(i)" :disabled="i === players.length - 1">↓</button>
                <button class="btn-icon danger" @click="removePlayer(i)">×</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="table-actions">
          <button class="btn-small" @click="addPlayer" :disabled="players.length >= 64">
            + 添加选手
          </button>
        </div>
      </div>

      <div class="hint">
        已识别 {{ validPlayers.length }} 位选手，共 {{ totalRounds }} 轮
      </div>
      <button class="btn-primary" @click="create">
        创建比赛
      </button>
    </div>

    <div class="panel">
      <h2>已保存的比赛</h2>
      <ul class="list">
        <li v-for="t in savedTournaments" :key="t.id" class="item">
          <span>{{ t.name }}</span>
          <div class="actions">
            <button class="btn-small" @click="load(t.id)">加载</button>
            <button class="btn-small danger" @click="remove(t.id)">删除</button>
          </div>
        </li>
        <li v-if="savedTournaments.length === 0" class="empty">暂无比赛</li>
      </ul>
    </div>
  </div>

  <AlertModal :visible="alertVisible" :message="alertMessage" @close="alertVisible = false" />
</template>

<style scoped>
.setup {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.panel {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
}

.panel h2 {
  margin: 0 0 12px;
  font-size: 16px;
}

.field {
  margin-bottom: 12px;
}

.field label {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
  color: #636e72;
}

.field input {
  width: 100%;
  padding: 8px;
  border: 1px solid #b2bec3;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

.player-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: white;
  border-radius: 4px;
  overflow: hidden;
}

.player-table th,
.player-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #dfe6e9;
  text-align: left;
}

.player-table th {
  background: #f1f3f4;
  font-weight: 600;
  color: #636e72;
  font-size: 12px;
}

.player-row {
  cursor: grab;
}

.player-row:active {
  cursor: grabbing;
}

.player-row:hover {
  background: #f8f9fa;
}

.seed-cell {
  width: 40px;
  text-align: center;
  color: #636e72;
  font-weight: 600;
}

.name-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #dfe6e9;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.actions-cell {
  display: flex;
  gap: 4px;
}

.btn-icon {
  padding: 2px 6px;
  font-size: 12px;
  border: 1px solid #b2bec3;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  line-height: 1;
}

.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-icon.danger {
  color: #d63031;
  border-color: #d63031;
}

.table-actions {
  margin-top: 8px;
}

.hint {
  font-size: 13px;
  color: #636e72;
  margin-bottom: 12px;
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

.btn-primary:disabled {
  background: #b2bec3;
  cursor: not-allowed;
}

.list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #dfe6e9;
}

.empty {
  color: #636e72;
  font-size: 13px;
  padding: 8px 0;
}

.actions {
  display: flex;
  gap: 6px;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #b2bec3;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.btn-small:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-small.danger {
  color: #d63031;
  border-color: #d63031;
}
</style>
