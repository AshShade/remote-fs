<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{ go: [path: string] }>();
const input = ref("");

function submit() {
  if (input.value.trim()) {
    emit("go", input.value);
    input.value = "";
  }
}
</script>

<template>
  <div class="pathbar">
    <input v-model="input" type="text" placeholder="Enter path… (e.g. /projects/foo)" @keydown.enter="submit" />
    <button @click="submit">Go</button>
  </div>
</template>

<style scoped>
.pathbar { display: flex; gap: 8px; margin-bottom: 12px; }
.pathbar input { flex: 1; background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 6px 12px; font-size: 13px; font-family: inherit; outline: none; }
.pathbar input:focus { border-color: #cba6f7; }
.pathbar input::placeholder { color: #585b70; }
.pathbar button { background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.pathbar button:hover { border-color: #cba6f7; color: #cba6f7; }
</style>
