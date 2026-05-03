<script setup lang="ts">
import { ref, onMounted } from "vue";

defineProps<{ title: string }>();
const emit = defineEmits<{ close: [value: string | null] }>();
const input = ref("");
const inputEl = ref<HTMLInputElement>();

function submit() { emit("close", input.value.trim() || null); }
function cancel() { emit("close", null); }

onMounted(() => inputEl.value?.focus());
</script>

<template>
  <div class="modal-bg" @click.self="cancel">
    <div class="modal">
      <h3>{{ title }}</h3>
      <input ref="inputEl" v-model="input" @keydown.enter="submit" @keydown.esc="cancel" />
      <div class="modal-btns">
        <button @click="cancel">Cancel</button>
        <button class="primary" @click="submit">OK</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 998; }
.modal { background: #1e1e2e; border: 1px solid #45475a; border-radius: 10px; padding: 20px; min-width: 300px; }
.modal h3 { color: #cba6f7; font-size: 14px; margin-bottom: 12px; font-weight: 500; }
.modal input { width: 100%; background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 8px 12px; font-size: 13px; font-family: inherit; outline: none; box-sizing: border-box; }
.modal input:focus { border-color: #cba6f7; }
.modal-btns { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.modal-btns button { background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 6px 16px; font-size: 13px; cursor: pointer; }
.modal-btns button:hover { border-color: #cba6f7; color: #cba6f7; }
.modal-btns button.primary { background: #cba6f7; color: #1e1e2e; border-color: #cba6f7; }
.modal-btns button.primary:hover { background: #b4befe; }
</style>
