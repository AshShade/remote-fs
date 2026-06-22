<script setup lang="ts">
import { type DirEntry, fmtSize } from "../api";
import { Folder, File, ExternalLink, Download, Trash2 } from "lucide-vue-next";

const props = defineProps<{ entries: DirEntry[]; curPath: string }>();
const emit = defineEmits<{ nav: [path: string]; open: [path: string]; delete: [path: string, name: string] }>();

function href(e: DirEntry) {
  return props.curPath + "/" + encodeURIComponent(e.name) + (e.dir ? "/" : "");
}

function parentPath() {
  return props.curPath.replace(/\/[^/]*\/?$/, "/") || "/";
}
function isHtml(name: string) {
  return /\.html?$/i.test(name);
}
</script>

<template>
  <table>
    <thead>
      <tr><th></th><th>Name</th><th></th><th>Size</th><th>Modified</th><th></th></tr>
    </thead>
    <tbody>
      <tr v-if="curPath !== '' && curPath !== '/'" @click="emit('nav', parentPath())">
        <td><Folder :size="18" /></td><td><a @click.prevent>.. </a></td><td></td><td>—</td><td></td><td></td>
      </tr>
      <tr v-for="e in entries" :key="e.name">
        <td><Folder v-if="e.dir" :size="18" /><File v-else :size="18" /></td>
        <td>
          <a v-if="e.dir" @click="emit('nav', href(e))">{{ e.name }}/</a>
          <a v-else @click="emit('open', href(e))">{{ e.name }}</a>
        </td>
        <td class="actions">
          <a v-if="!e.dir && isHtml(e.name)" :href="'/__raw' + href(e)" target="_blank" class="act" title="Preview in new tab"><ExternalLink :size="16" /></a>
          <a v-if="!e.dir" :href="href(e) + '?download'" class="act" title="Download"><Download :size="16" /></a>
          <a v-if="e.dir" :href="href(e) + '?download'" class="act" title="Download as zip"><Download :size="16" /></a>
        </td>
        <td>{{ e.dir ? "—" : fmtSize(e.size) }}</td>
        <td class="mtime">{{ e.mtime }}</td>
        <td><a class="act del" title="Delete" @click.stop="emit('delete', href(e), e.name)"><Trash2 :size="16" /></a></td>
      </tr>
    </tbody>
  </table>
  <div class="footer">{{ entries.length }} items</div>
</template>

<style scoped>
table { width: 100%; border-collapse: collapse; }
th { text-align: left; color: #a6adc8; font-size: 12px; font-weight: 500; padding: 6px 12px; border-bottom: 1px solid #313244; }
td { padding: 8px 12px; border-bottom: 1px solid #313244; font-size: 14px; color: #cdd6f4; }
tr:hover { background: #313244; cursor: default; }
td:first-child { width: 28px; text-align: center; color: #585b70; }
.actions { width: 56px; white-space: nowrap; }
td:nth-child(4) { color: #a6adc8; font-size: 13px; width: 80px; text-align: right; }
.mtime { color: #585b70; font-size: 12px; width: 160px; text-align: right; }
.act { color: #585b70; text-decoration: none; margin-right: 6px; cursor: pointer; display: inline-flex; vertical-align: middle; }
.act:hover { color: #89b4fa; }
.del:hover { color: #f38ba8; }
.footer { margin-top: 20px; color: #585b70; font-size: 12px; }
</style>
