<script setup lang="ts">
import { watch, ref } from "vue";

const props = defineProps<{ msg: string; type: string }>();
const emit = defineEmits<{ done: [] }>();
const show = ref(false);
let tid: ReturnType<typeof setTimeout>;

watch(() => props.msg, (v) => {
  if (!v) return;
  show.value = true;
  clearTimeout(tid);
  tid = setTimeout(() => { show.value = false; emit("done"); }, 3000);
});
</script>

<template>
  <div class="toast" :class="[type, { show }]">{{ msg }}</div>
</template>

<style scoped>
.toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(20px); background: #313244; color: #cdd6f4; border: 1px solid #45475a; border-radius: 8px; padding: 10px 20px; font-size: 13px; opacity: 0; transition: opacity 0.3s, transform 0.3s; pointer-events: none; z-index: 999; max-width: 90vw; }
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
.toast.error { border-color: #f38ba8; color: #f38ba8; }
.toast.warn { border-color: #fab387; color: #fab387; }
</style>
