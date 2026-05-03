<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{ mkdir: []; upload: [files: FileList] }>();
const fileInput = ref<HTMLInputElement>();

function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files?.length) emit("upload", files);
}
</script>

<template>
  <div class="toolbar">
    <button @click="emit('mkdir')">📁 New folder</button>
    <button @click="fileInput?.click()">📄 Upload file</button>
    <input ref="fileInput" type="file" multiple hidden @change="onFiles" />
  </div>
</template>

<style scoped>
.toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
.toolbar button { background: #313244; border: 1px solid #45475a; border-radius: 6px; color: #cdd6f4; padding: 6px 14px; font-size: 13px; cursor: pointer; }
.toolbar button:hover { border-color: #cba6f7; color: #cba6f7; }
</style>
