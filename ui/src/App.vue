<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { checkPath, listDir, createDir, uploadFile, type DirEntry } from "./api";
import FileTable from "./components/FileTable.vue";
import FileViewer from "./components/FileViewer.vue";
import PathBar from "./components/PathBar.vue";
import Toolbar from "./components/Toolbar.vue";
import Toast from "./components/Toast.vue";
import Modal from "./components/Modal.vue";

const curPath = ref(location.pathname.replace(/\/$/, "") || "");
const entries = ref<DirEntry[]>([]);
const notFound = ref(false);
const viewingFile = ref("");
const toastMsg = ref("");
const toastType = ref("");
const modalOpen = ref(false);
const modalTitle = ref("");
let modalResolve: ((v: string | null) => void) | null = null;

const breadcrumbParts = computed(() => {
  const base = viewingFile.value
    ? viewingFile.value.slice(0, viewingFile.value.lastIndexOf("/"))
    : curPath.value;
  const parts = base.split("/").filter(Boolean);
  const crumbs = [{ label: "~", path: "/" }].concat(
    parts.map((s, i) => ({ label: s, path: "/" + parts.slice(0, i + 1).join("/") + "/" }))
  );
  if (viewingFile.value) {
    crumbs.push({ label: viewingFile.value.split("/").pop()!, path: "" });
  }
  return crumbs;
});

async function nav(path: string) {
  viewingFile.value = "";
  const data = await listDir(path);
  if (data.length === 0) {
    // Verify it's actually a missing path vs empty directory
    const { ok, isDir } = await checkPath(path);
    if (!ok) {
      notFound.value = true;
      curPath.value = path.replace(/\/$/, "") || "";
      entries.value = [];
      history.pushState(null, "", path.endsWith("/") || path === "" ? path || "/" : path + "/");
      document.title = "404 — remote-fs";
      return;
    }
  }
  notFound.value = false;
  curPath.value = path.replace(/\/$/, "") || "";
  entries.value = data;
  history.pushState(null, "", path.endsWith("/") || path === "" ? path || "/" : path + "/");
  document.title = "remote-fs " + (curPath.value === "" ? "~" : "~" + curPath.value);
}

function toast(msg: string, type = "") {
  toastMsg.value = msg;
  toastType.value = type;
}

function showModal(title: string): Promise<string | null> {
  modalTitle.value = title;
  modalOpen.value = true;
  return new Promise((r) => (modalResolve = r));
}

function onModalClose(value: string | null) {
  modalOpen.value = false;
  modalResolve?.(value);
  modalResolve = null;
}

async function mkdir() {
  const name = await showModal("New folder name");
  if (!name) return;
  await createDir(curPath.value + "/" + encodeURIComponent(name));
  await nav(curPath.value + "/");
}

async function upload(files: FileList) {
  await Promise.all(
    [...files].map((f) =>
      f.arrayBuffer().then((buf) =>
        uploadFile(curPath.value + "/" + encodeURIComponent(f.name), buf)
      )
    )
  );
  await nav(curPath.value + "/");
}

function openFile(path: string) {
  viewingFile.value = path;
  history.pushState(null, "", path);
  document.title = "remote-fs ~" + path;
}

async function goPath(raw: string) {
  let p = raw.trim();
  if (!p) return;
  if (!p.startsWith("/")) p = (curPath.value || "") + "/" + p;

  const { ok, isDir } = await checkPath(p);
  if (ok) {
    if (isDir) { await nav(p); return; }
    if (!isDir) { openFile(p); return; }
    return;
  }

  const orig = p;
  while (p.lastIndexOf("/") > 0) {
    p = p.slice(0, p.lastIndexOf("/"));
    const check = await checkPath(p + "/");
    if (check.ok) {
      await nav(p + "/");
      toast("Not found: \u2026" + orig.slice(p.length) + " \u2014 navigated to nearest parent", "warn");
      return;
    }
  }
  toast("Path not found: " + orig, "error");
}

onMounted(() => {
  // Check if initial path is a file (has extension) or directory
  const initPath = location.pathname;
  if (initPath.match(/\.\w+$/) && !initPath.endsWith("/")) {
    // File path — show viewer, load parent directory in background
    const dir = initPath.slice(0, initPath.lastIndexOf("/") + 1) || "/";
    nav(dir).then(() => { viewingFile.value = initPath; });
  } else {
    nav(initPath);
  }
  window.addEventListener("popstate", () => {
    const p = location.pathname;
    if (p.match(/\.\w+$/) && !p.endsWith("/")) {
      viewingFile.value = p;
    } else {
      viewingFile.value = "";
      nav(p);
    }
  });
});
</script>

<template>
  <div v-if="notFound" class="not-found">
    <h1>404</h1>
    <p>This path doesn't exist</p>
    <button @click="nav('/')">Go home</button>
  </div>
  <template v-else>
    <h1>
      remote-fs
      <span class="breadcrumb">
        <template v-for="(c, i) in breadcrumbParts" :key="i">
          <a v-if="c.path" @click="nav(c.path)">{{ c.label }}</a>
          <span v-else class="current">{{ c.label }}</span>
        </template>
      </span>
    </h1>
    <Toolbar v-if="!viewingFile" @mkdir="mkdir" @upload="upload" />
    <PathBar v-if="!viewingFile" @go="goPath" />
    <FileViewer v-if="viewingFile" :path="viewingFile" @close="viewingFile = ''" />
    <FileTable v-else :entries="entries" :curPath="curPath" @nav="nav" @open="openFile" />
    <Toast :msg="toastMsg" :type="toastType" @done="toastMsg = ''" />
    <Modal v-if="modalOpen" :title="modalTitle" @close="onModalClose" />
  </template>
</template>

<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #1e1e2e; color: #cdd6f4; font-family: -apple-system, 'SF Mono', monospace; padding: 24px; }
h1 { color: #cba6f7; font-size: 18px; margin-bottom: 16px; font-weight: 500; }
.breadcrumb { color: #585b70; }
.breadcrumb a { color: #a6adc8; cursor: pointer; text-decoration: none; }
.breadcrumb a:hover { color: #cba6f7; }
.breadcrumb a:last-child { color: #cdd6f4; }
.breadcrumb a + a::before { content: " / "; color: #585b70; }
.breadcrumb a + span::before, .breadcrumb span + a::before { content: " / "; color: #585b70; }
.breadcrumb .current { color: #cdd6f4; }
a { color: #89b4fa; text-decoration: none; }
a:hover { color: #b4befe; text-decoration: underline; }
.not-found { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 80vh; }
.not-found h1 { font-size: 96px; color: #585b70; font-weight: 700; margin: 0; }
.not-found p { color: #6c7086; font-size: 16px; margin: 12px 0 32px; }
.not-found button { background: #cba6f7; color: #1e1e2e; border: none; padding: 10px 24px; border-radius: 6px; font-size: 14px; cursor: pointer; font-family: inherit; }
.not-found button:hover { background: #b4befe; }
</style>
