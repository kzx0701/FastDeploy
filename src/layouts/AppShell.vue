<template>
  <div class="app-shell-root grid h-screen grid-cols-[220px_minmax(0,1fr)] overflow-hidden text-foreground">
    <aside class="app-shell-sidebar flex min-h-0 flex-col bg-sidebar" :class="{ 'app-shell-sidebar--macos': isMacOS }">
      <div class="app-shell-brand-wrap" :data-tauri-drag-region="isMacOS">
        <div class="app-shell-brand" :data-tauri-drag-region="isMacOS">
          <XClawWordmark font-size="1.42rem" @click="openReleasePage" />
          <span class="app-version-badge">v{{ appVersion }}</span>
        </div>
      </div>

      <!-- 主菜单 -->
      <nav v-if="appStore.activePanel !== 'settings'" class="app-shell-nav" aria-label="主菜单">
        <button
          v-for="item in navItems"
          :key="item.value"
          type="button"
          :data-active="appStore.activePanel === item.value"
          class="app-shell-nav-item group"
          @click="handleNavClick(item.value)"
        >
          <component :is="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <!-- 设置菜单 -->
      <nav v-else class="app-shell-nav" aria-label="设置菜单">
        <button
          type="button"
          class="app-shell-nav-item app-shell-settings-back"
          @click="handleNavClick('config')"
        >
          <ArrowLeft class="h-4 w-4" />
          <span>返回工作区</span>
        </button>

        <Separator class="app-shell-nav-divider" />

        <button
          v-for="item in settingsItems"
          :key="item.value"
          type="button"
          :data-active="appStore.activeSettingsTab === item.value"
          class="app-shell-nav-item group"
          @click="appStore.setActiveSettingsTab(item.value)"
        >
          <component :is="item.icon" class="h-4 w-4" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div v-if="appStore.activePanel !== 'settings'" class="mt-auto px-3 pb-4">
        <button
          type="button"
          class="app-shell-footer-entry group"
          @click="appStore.setActivePanel('settings'); appStore.setActiveSettingsTab('general')"
        >
          <Settings2 class="h-4 w-4" />
          <span>设置</span>
        </button>
      </div>
    </aside>

    <main class="app-shell-main min-w-0 bg-background">
      <div v-if="isMacOS" class="app-shell-drag-bar" data-tauri-drag-region></div>
      <div :class="['h-screen overflow-auto', isMacOS ? 'app-shell-main-scroll--macos' : '', contentClass || 'px-8 py-6']">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ArrowLeft, Clock, Database, FolderKanban, Info, Server, Settings2 } from "lucide-vue-next";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";

import XClawWordmark from "@/components/XClawWordmark.vue";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/stores/app";

defineProps<{
  contentClass?: string
}>()

const appStore = useAppStore();
const appVersion = ref("1.0.0");
const releaseUrl = "https://github.com/kzx0701/FastDeploy/releases";
const isMacOS = navigator.platform.toUpperCase().includes("MAC");

const navItems = [
  { value: "config", label: "项目", icon: FolderKanban },
  { value: "servers", label: "服务器", icon: Server },
  { value: "deployLogs", label: "日志", icon: Clock },
] as const;

const settingsItems = [
  { value: "general", label: "常规", icon: Settings2 },
  { value: "timeout", label: "超时配置", icon: Clock },
  { value: "data", label: "数据管理", icon: Database },
  { value: "about", label: "关于", icon: Info },
] as const;

async function openReleasePage() {
  try {
    await invoke("open_external_url", { url: releaseUrl });
  } catch {
    window.open(releaseUrl, "_blank", "noopener,noreferrer");
  }
}

function handleNavClick(panel: string) {
  if (panel === 'config' && appStore.activePanel === 'config') {
    window.dispatchEvent(new CustomEvent('fastdeploy:navigate-project-list'))
  }
  appStore.setActivePanel(panel as any)
}

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch {
    appVersion.value = "1.0.0";
  }
});
</script>

<style scoped>
.app-shell-root {
  background: var(--background);
}

.app-shell-sidebar {
  background: var(--sidebar);
  border-right: 1px solid var(--sidebar-border);
}

.app-shell-main {
  background: var(--background);
  position: relative;
  display: flex;
  flex-direction: column;
}

.app-shell-drag-bar {
  flex-shrink: 0;
  height: 28px;
  background: var(--background);
}

.app-shell-main-scroll--macos {
  height: calc(100vh - 28px);
}

.app-shell-brand-wrap {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 76px;
  padding: 0 12px;
}

.app-shell-sidebar--macos .app-shell-brand-wrap {
  padding-top: 28px;
}

.app-shell-brand {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 9px;
  min-width: 0;
  color: var(--text-primary);
}

.app-version-badge {
  display: inline-flex;
  align-items: baseline;
  flex: 0 0 auto;
  height: auto;
  padding: 2px 5px 1px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface-hover);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0;
}

.app-shell-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
}

.app-shell-nav-divider {
  margin: 8px 0;
}

.app-shell-settings-back {
  color: var(--text-muted) !important;
}

.app-shell-settings-back:hover {
  color: var(--text-primary) !important;
}

.app-shell-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  text-align: left;
}

.app-shell-nav-item svg {
  color: var(--text-muted);
  transition: color 140ms ease;
}

.app-shell-nav-item:hover {
  border-color: var(--border);
  background: var(--surface-hover);
  color: var(--text-primary);
}

.app-shell-nav-item[data-active="true"] {
  border-color: var(--text-primary);
  background: var(--text-primary);
  color: var(--surface);
}

.app-shell-nav-item[data-active="true"] svg {
  color: var(--surface);
}

.app-shell-footer-entry {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  width: 100%;
  height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--text-secondary);
  text-align: left;
  transition: all 140ms ease;
}

.app-shell-footer-entry svg {
  color: var(--text-muted);
  transition: color 140ms ease;
}

.app-shell-footer-entry:hover {
  background: var(--surface-active);
  color: var(--text-primary);
}

.app-shell-footer-entry:hover svg {
  color: var(--text-primary);
}
</style>
