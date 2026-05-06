<script setup lang="ts">
defineProps<{
  message: string;
  visible: boolean;
}>();

const emit = defineEmits<{ (e: 'close'): void }>();
</script>

<template>
  <div v-if="visible" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-box">
      <div class="modal-message">{{ message }}</div>
      <div class="modal-actions">
        <button class="btn-confirm" @click="emit('close')">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-box {
  background: #fff;
  border-radius: 8px;
  padding: 24px 28px;
  min-width: 280px;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.modal-message {
  font-size: 15px;
  color: #2d3436;
  margin-bottom: 20px;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: center;
}

.btn-confirm {
  padding: 8px 24px;
  font-size: 14px;
  background: #0984e3;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-confirm:hover {
  background: #0770c2;
}
</style>
