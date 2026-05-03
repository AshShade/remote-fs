<script setup lang="ts">
import { type DirEntry, fmtSize } from "../api";

const props = defineProps<{ entries: DirEntry[]; curPath: string }>();
const emit = defineEmits<{ nav: [path: string]; open: [path: string] }>();

function href(e: DirEntry) {
  return props.curPath + "/" + encodeURIComponent(e.name) + (e.dir ? "/" : "");
}

function parentPath() {
  return props.curPath.replace(/\/[^/]*\/?$/, "/") || "/";
}
</script>

<template>
  <table>
    <thead>
      <tr><th></th><th>Name</th><th></th><th>Size</th><th>Modified</th></tr>
    </thead>
    <tbody>
      <tr v-if="curPath !== '' && curPath !== '/'" @click="emit('nav', parentPath())">
        <td>📁</td><td><a @click.prevent>.. </a></td><td></td><td>—</td><td></td>
      </tr>
      <tr v-for="e in entries" :key="e.name">
        <td>{{ e.dir ? "📁" : "📄" }}</td>
        <td>
          <a v-if="e.dir" @click="emit('nav', href(e))">{{ e.name }}/</a>
          <a v-else @click="emit('open', href(e))">{{ e.name }}</a>
        </td>
        <td>
          <a v-if="!e.dir" :href="href(e) + '?download'" class="dl" title="Download">⬇</a>
        </td>
        <td>{{ e.dir ? "—" : fmtSize(e.size) }}</td>
        <td class="mtime">{{ e.mtime }}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">{{ entries.length }} items</div>
</template>

<style scoped>
table { width: 100%; border-collapse: collapse; }
th { text-align: left; color: #a6adc8; font-size: 12px; font-weight: 500; padding: 6px 12px; border-bottom: 1px solid #313244; }
td { padding: 8px 12px; border-bottom: 1px solid #313244; font-size: 14px; }
tr:hover { background: #313244; cursor: default; }
td:first-child { width: 28px; text-align: center; }
td:nth-child(3) { width: 32px; text-align: center; }
td:nth-child(4) { color: #a6adc8; font-size: 13px; width: 80px; text-align: right; }
.mtime { color: #585b70; font-size: 12px; width: 160px; text-align: right; }
.dl { color: #585b70; font-size: 12px; text-decoration: none; }
.dl:hover { color: #89b4fa; }
.footer { margin-top: 20px; color: #585b70; font-size: 12px; }
</style>
