<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ path: string }>();
const emit = defineEmits<{ close: [] }>();
const content = ref("");
const mode = ref<"html" | "text" | "image" | "binary">("text");
const loading = ref(true);

const imageExts = /\.(png|jpe?g|gif|svg|webp|ico|bmp)$/i;
const textExts = /\.(txt|json|ts|js|vue|css|html|xml|yaml|yml|toml|sh|bash|zsh|py|rb|go|rs|java|kt|c|h|cpp|hpp|csv|log|conf|cfg|ini|env|gitignore|md)$/i;

async function load(path: string) {
  loading.value = true;
  const name = path.split("/").pop() || "";

  if (imageExts.test(name)) {
    mode.value = "image";
    content.value = path;
    loading.value = false;
    return;
  }

  const r = await fetch(path);
  if (!r.ok) { content.value = "Failed to load file"; mode.value = "text"; loading.value = false; return; }

  const ct = r.headers.get("Content-Type") || "";
  if (ct.includes("text/html") && name.endsWith(".md")) {
    // Markdown rendered as HTML by backend — extract body content
    const html = await r.text();
    const match = html.match(/<body>([\s\S]*)<\/body>/);
    content.value = match ? match[1] : html;
    mode.value = "html";
  } else if (ct.includes("text") || textExts.test(name)) {
    content.value = await r.text();
    mode.value = "text";
  } else {
    content.value = path;
    mode.value = "binary";
  }
  loading.value = false;
}

watch(() => props.path, load, { immediate: true });
</script>

<template>
  <div class="viewer">
    <div class="viewer-bar">
      <span class="viewer-name">{{ path.split("/").pop() }}</span>
      <a :href="path + '?download'" class="viewer-btn" title="Download">⬇</a>
      <button class="viewer-btn" @click="emit('close')" title="Close">✕</button>
    </div>
    <div v-if="loading" class="viewer-loading">Loading…</div>
    <div v-else-if="mode === 'html'" class="viewer-html" v-html="content" />
    <pre v-else-if="mode === 'text'" class="viewer-text">{{ content }}</pre>
    <div v-else-if="mode === 'image'" class="viewer-image"><img :src="content" /></div>
    <div v-else class="viewer-binary">
      <p>Binary file — cannot preview</p>
      <a :href="path + '?download'" class="dl-btn">Download</a>
    </div>
  </div>
</template>

<style scoped>
.viewer { margin-top: 4px; }
.viewer-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #181825; border: 1px solid #313244; border-radius: 8px 8px 0 0; }
.viewer-name { flex: 1; color: #cba6f7; font-size: 13px; font-weight: 500; }
.viewer-btn { background: none; border: none; color: #585b70; font-size: 14px; cursor: pointer; text-decoration: none; padding: 2px 6px; border-radius: 4px; }
.viewer-btn:hover { color: #cdd6f4; background: #313244; }
.viewer-loading { padding: 24px; color: #585b70; text-align: center; }
.viewer-html { padding: 24px; background: #1e1e2e; border: 1px solid #313244; border-top: none; border-radius: 0 0 8px 8px; line-height: 1.7; }
.viewer-html :deep(h1), .viewer-html :deep(h2), .viewer-html :deep(h3) { color: #cba6f7; margin: 1em 0 0.5em; }
.viewer-html :deep(h1) { font-size: 1.5em; border-bottom: 1px solid #313244; padding-bottom: 0.3em; }
.viewer-html :deep(a) { color: #89b4fa; }
.viewer-html :deep(code) { background: #313244; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
.viewer-html :deep(pre) { background: #313244; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 0.8em 0; }
.viewer-html :deep(pre code) { background: none; padding: 0; }
.viewer-html :deep(blockquote) { border-left: 3px solid #cba6f7; padding: 0.5em 1em; color: #a6adc8; background: #181825; border-radius: 0 6px 6px 0; margin: 0.8em 0; }
.viewer-html :deep(table) { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
.viewer-html :deep(th), .viewer-html :deep(td) { border: 1px solid #45475a; padding: 6px 10px; text-align: left; }
.viewer-html :deep(th) { background: #313244; color: #cba6f7; }
.viewer-html :deep(ul), .viewer-html :deep(ol) { padding-left: 2em; margin: 0.5em 0; }
.viewer-html :deep(p) { margin: 0.6em 0; }
.viewer-html :deep(img) { max-width: 100%; border-radius: 6px; }
.viewer-text { padding: 16px; background: #181825; border: 1px solid #313244; border-top: none; border-radius: 0 0 8px 8px; font-size: 13px; line-height: 1.6; overflow-x: auto; color: #cdd6f4; margin: 0; white-space: pre-wrap; word-break: break-all; }
.viewer-image { padding: 16px; background: #181825; border: 1px solid #313244; border-top: none; border-radius: 0 0 8px 8px; text-align: center; }
.viewer-image img { max-width: 100%; max-height: 70vh; border-radius: 6px; }
.viewer-binary { padding: 24px; background: #181825; border: 1px solid #313244; border-top: none; border-radius: 0 0 8px 8px; text-align: center; color: #585b70; }
.dl-btn { display: inline-block; margin-top: 12px; background: #cba6f7; color: #1e1e2e; padding: 8px 20px; border-radius: 6px; text-decoration: none; font-size: 13px; }
.dl-btn:hover { background: #b4befe; }
</style>
