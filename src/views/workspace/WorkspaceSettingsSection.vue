<template>
  <section class="settings-page">
    <header class="settings-header">
      <h1>{{ currentTab?.label }}</h1>
    </header>

    <!-- 常规 -->
    <div v-if="activeTab === 'general'" class="settings-content">
      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">界面主题</label>
            <span class="settings-row-desc">切换应用界面使用的主题外观。</span>
          </div>
          <div class="settings-row-control">
            <div class="settings-select-group">
                <button
                  v-for="t in themeOptions"
                  :key="t.value"
                  type="button"
                  class="settings-select-btn"
                  :data-active="theme === t.value"
                  @click="theme = t.value"
                >
                  <component :is="t.icon" class="h-4 w-4" />
                  <span>{{ t.label }}</span>
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 超时配置 -->
    <div v-if="activeTab === 'timeout'" class="settings-content">
      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">本地打包超时</label>
            <span class="settings-row-desc">打包命令执行的最大等待时间，超时后将自动终止进程。</span>
          </div>
          <div class="settings-row-control">
            <NumberField :model-value="settings.buildTimeout" :min="60" :max="3600" @update:model-value="handleSettingChange('buildTimeout', $event)">
              <NumberFieldInput class="settings-input" />
            </NumberField>
            <span class="settings-unit">秒</span>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">部署后命令超时</label>
            <span class="settings-row-desc">远端部署后执行命令的最大等待时间。</span>
          </div>
          <div class="settings-row-control">
            <NumberField :model-value="settings.deployTimeout" :min="30" :max="1800" @update:model-value="handleSettingChange('deployTimeout', $event)">
              <NumberFieldInput class="settings-input" />
            </NumberField>
            <span class="settings-unit">秒</span>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">SSH 连接超时</label>
            <span class="settings-row-desc">SSH 连接建立的最大等待时间。</span>
          </div>
          <div class="settings-row-control">
            <NumberField :model-value="settings.sshTimeout" :min="5" :max="120" @update:model-value="handleSettingChange('sshTimeout', $event)">
              <NumberFieldInput class="settings-input" />
            </NumberField>
            <span class="settings-unit">秒</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据管理 -->
    <div v-if="activeTab === 'data'" class="settings-content">
      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">部署历史保留数量</label>
            <span class="settings-row-desc">保留最近的部署记录条数，超出部分将自动清理。</span>
          </div>
          <div class="settings-row-control">
            <NumberField :model-value="settings.historyLimit" :min="10" :max="500" @update:model-value="handleHistoryLimitChange">
              <NumberFieldInput class="settings-input" />
            </NumberField>
            <span class="settings-unit">条</span>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">数据操作</div>
        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">导出数据</label>
            <span class="settings-row-desc">将项目、服务器、环境配置导出为 JSON 文件。</span>
          </div>
          <div class="settings-row-control">
            <Button variant="outline" size="icon" class="settings-action-btn" @click="handleExport">
              <Download class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">导入数据</label>
            <span class="settings-row-desc">从 JSON 文件导入项目、服务器、环境配置。</span>
          </div>
          <div class="settings-row-control">
            <Button variant="outline" size="icon" class="settings-action-btn" @click="handleImport">
              <Upload class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div class="settings-section settings-section-danger">
        <div class="settings-section-header">危险操作</div>
        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">清空部署历史</label>
            <span class="settings-row-desc">删除所有部署历史记录，此操作不可撤销。</span>
          </div>
          <div class="settings-row-control">
            <Button variant="outline" size="icon" class="settings-action-danger" @click="handleClearHistory">
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">重置所有数据</label>
            <span class="settings-row-desc">清除所有项目、服务器、环境配置和部署历史。</span>
          </div>
          <div class="settings-row-control">
            <Button variant="outline" size="icon" class="settings-action-danger" @click="handleResetAll">
              <RefreshCw class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 关于 -->
    <div v-if="activeTab === 'about'" class="settings-content">
      <div class="settings-section">
        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">当前版本</label>
            <span class="settings-row-desc">FastDeploy 桌面应用</span>
          </div>
          <div class="settings-row-control">
            <Badge variant="secondary" class="settings-badge">v{{ appVersion }}</Badge>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">检查更新</label>
            <span class="settings-row-desc">检查是否有新版本可用。</span>
          </div>
          <div class="settings-row-control">
            <Button variant="outline" size="icon" class="settings-action-btn" @click="handleCheckUpdate">
              <RefreshCw class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">GitHub</label>
            <span class="settings-row-desc">访问项目源代码仓库。</span>
          </div>
          <div class="settings-row-control">
            <Button variant="outline" size="icon" class="settings-action-btn" @click="handleOpenGitHub">
              <ExternalLink class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="settings-row">
          <div class="settings-row-info">
            <label class="settings-row-label">意见反馈</label>
            <span class="settings-row-desc">有问题或建议？联系开发者。</span>
          </div>
          <div class="settings-row-control">
            <Button variant="outline" size="icon" class="settings-action-btn" @click="feedbackVisible = true">
              <MessageSquare class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- 意见反馈弹窗 -->
  <Dialog :open="feedbackVisible" @update:open="feedbackVisible = $event">
    <DialogContent class="feedback-dialog">
      <DialogHeader class="feedback-header">
        <div class="feedback-avatar">
          <User class="h-6 w-6" />
        </div>
        <DialogTitle class="feedback-title">意见反馈</DialogTitle>
        <DialogDescription class="feedback-desc">
          如有问题或建议，欢迎通过邮箱联系开发者
        </DialogDescription>
      </DialogHeader>

      <div class="feedback-card">
        <div class="feedback-info-row">
          <span class="feedback-label">开发者</span>
          <span class="feedback-value">寇子轩</span>
        </div>
        <div class="feedback-info-row">
          <span class="feedback-label">联系邮箱</span>
          <button class="feedback-email" @click="handleCopyEmail">839711518@qq.com</button>
        </div>
      </div>

      <div class="feedback-tip">
        <Mail class="h-3.5 w-3.5" />
        <span>点击邮箱地址即可复制</span>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, markRaw } from "vue";
import { Download, Upload, Trash2, RefreshCw, ExternalLink, Monitor, Moon, Sun, MessageSquare, User, Mail } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { NumberField, NumberFieldInput } from "@/components/ui/number-field";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

import { showToast } from "@/services/ui/toast";
import { useConfirm } from "@/services/ui/confirm";
import { useAppStore } from "@/stores/app";
import { useTheme } from "@/composables/useTheme";
import { loadProjects, saveProjects } from "@/services/storage/projects";
import { loadServers, saveServers } from "@/services/storage/servers";
import { loadEnvironments, saveEnvironments } from "@/services/storage/environments";
import { loadTaskHistory, saveTaskHistory } from "@/services/storage/task-history";

const confirm = useConfirm();
const appStore = useAppStore();
const { theme } = useTheme();
const appVersion = ref("1.0.0");
const feedbackVisible = ref(false);

const activeTab = computed(() => appStore.activeSettingsTab);

const tabs = [
  { value: "general", label: "常规" },
  { value: "timeout", label: "超时配置" },
  { value: "data", label: "数据管理" },
  { value: "about", label: "关于" },
];

const currentTab = computed(() => tabs.find((t) => t.value === activeTab.value));

const themeOptions = [
  { value: "system", label: "系统", icon: markRaw(Monitor) },
  { value: "dark", label: "深色", icon: markRaw(Moon) },
  { value: "light", label: "浅色", icon: markRaw(Sun) },
];

const HISTORY_LIMIT_KEY = "claw-deploy:history-limit"
const BUILD_TIMEOUT_KEY = "claw-deploy:build-timeout"
const DEPLOY_TIMEOUT_KEY = "claw-deploy:deploy-timeout"
const SSH_TIMEOUT_KEY = "claw-deploy:ssh-timeout"

function loadNumberSetting(key: string, min: number, max: number, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const val = parseInt(raw, 10)
      if (val >= min && val <= max) return val
    }
  } catch {}
  return fallback
}

const settings = reactive({
  buildTimeout: loadNumberSetting(BUILD_TIMEOUT_KEY, 60, 3600, 600),
  deployTimeout: loadNumberSetting(DEPLOY_TIMEOUT_KEY, 30, 1800, 300),
  sshTimeout: loadNumberSetting(SSH_TIMEOUT_KEY, 5, 120, 20),
  historyLimit: loadNumberSetting(HISTORY_LIMIT_KEY, 10, 500, 50),
});

function handleHistoryLimitChange(value: number) {
  settings.historyLimit = value
  localStorage.setItem(HISTORY_LIMIT_KEY, String(value))
  showToast("已保存", "success")
}

function handleSettingChange(key: keyof typeof settings, value: number) {
  settings[key] = value
  const keyMap: Record<string, string> = {
    buildTimeout: BUILD_TIMEOUT_KEY,
    deployTimeout: DEPLOY_TIMEOUT_KEY,
    sshTimeout: SSH_TIMEOUT_KEY,
  }
  if (keyMap[key]) {
    localStorage.setItem(keyMap[key], String(value))
  }
  showToast("已保存", "success")
}

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch {
    appVersion.value = "1.0.0";
  }
});

async function handleExport() {
  try {
    const filePath = await save({
      defaultPath: "fastdeploy-data.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
      title: "导出数据",
    })

    if (!filePath) return

    const [projects, servers, environments, taskHistory] = await Promise.all([
      loadProjects(),
      loadServers(),
      loadEnvironments(),
      loadTaskHistory(),
    ])

    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      projects,
      servers,
      environments,
      taskHistory,
    }

    await invoke("write_json_file", {
      path: filePath,
      content: JSON.stringify(data, null, 2),
    })

    showToast("数据已导出", "success")
  } catch (error) {
    if (typeof error === "string" && error.includes("取消")) return
    showToast("导出失败：" + (error instanceof Error ? error.message : String(error)), "error")
  }
}

async function handleImport() {
  try {
    const filePath = await open({
      multiple: false,
      filters: [{ name: "JSON", extensions: ["json"] }],
      title: "导入数据",
    })

    if (!filePath) return

    const path = typeof filePath === "string" ? filePath : filePath

    const content = await invoke<string>("read_json_file", { path })
    const data = JSON.parse(content)

    if (!data || typeof data !== "object") {
      showToast("文件格式无效", "error")
      return
    }

    if (!data.projects && !data.servers && !data.environments) {
      showToast("文件中未找到有效的配置数据", "error")
      return
    }

    confirm.require({
      message: "导入将覆盖当前的项目、服务器和环境配置，是否继续？",
      header: "确认导入",
      icon: Upload,
      rejectLabel: "取消",
      acceptLabel: "导入",
      accept: async () => {
        try {
          if (Array.isArray(data.projects)) await saveProjects(data.projects)
          if (Array.isArray(data.servers)) await saveServers(data.servers)
          if (Array.isArray(data.environments)) await saveEnvironments(data.environments)
          if (Array.isArray(data.taskHistory)) await saveTaskHistory(data.taskHistory)
          showToast("数据已导入，即将刷新页面", "success")
          setTimeout(() => window.location.reload(), 1000)
        } catch (e) {
          showToast("导入失败：" + (e instanceof Error ? e.message : String(e)), "error")
        }
      },
    })
  } catch (error) {
    if (typeof error === "string" && error.includes("取消")) return
    showToast("导入失败：" + (error instanceof Error ? error.message : String(error)), "error")
  }
}

function handleClearHistory() {
  confirm.require({
    message: "确认清空所有部署历史记录？此操作不可撤销。",
    header: "确认清空",
    icon: Trash2,
    rejectLabel: "取消",
    acceptLabel: "确认清空",
    acceptClass: "p-button-danger",
    accept: async () => {
      await saveTaskHistory([])
      showToast("部署历史已清空", "success")
    },
  })
}

function handleResetAll() {
  confirm.require({
    message: "确认重置所有数据？这将清除所有项目、服务器、环境配置和部署历史，此操作不可撤销！",
    header: "确认重置",
    icon: Trash2,
    rejectLabel: "取消",
    acceptLabel: "确认重置",
    acceptClass: "p-button-danger",
    accept: async () => {
      await Promise.all([
        saveProjects([]),
        saveServers([]),
        saveEnvironments([]),
        saveTaskHistory([]),
      ])
      showToast("所有数据已重置，即将刷新页面", "success")
      setTimeout(() => window.location.reload(), 1000)
    },
  })
}

function handleCheckUpdate() {
  showToast("自动更新功能暂未开放", "info");
}

async function handleCopyEmail() {
  try {
    await navigator.clipboard.writeText("839711518@qq.com")
    showToast("邮箱已复制", "success")
  } catch {
    showToast("复制失败", "error")
  }
}

async function handleOpenGitHub() {
  try {
    await invoke("open_external_url", { url: "https://github.com/kzx0701/FastDeploy" });
  } catch {
    window.open("https://github.com/kzx0701/FastDeploy", "_blank", "noopener,noreferrer");
  }
}
</script>

<style scoped>
.settings-page {
  min-height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.settings-header {
  width: 100%;
  max-width: 720px;
  margin-bottom: 20px;
}

.settings-header h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
}

.settings-content {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-section {
  border: 1px solid var(--card-border);
  border-radius: 4px;
  background: var(--surface);
  overflow: hidden;
}

.settings-section-danger {
  border-color: color-mix(in srgb, var(--danger-soft) 40%, transparent);
  background: var(--danger-tint);
}

.settings-section-danger .settings-section-header {
  color: color-mix(in srgb, var(--danger-soft) 70%, transparent);
  background: var(--danger-tint);
  border-bottom-color: color-mix(in srgb, var(--danger-soft) 40%, transparent);
}

.settings-section-header {
  padding: 8px 16px;
  background: var(--surface-hover);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  border-bottom: 1px solid var(--card-border);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--card-border);
}

.settings-row:last-child {
  border-bottom: none;
}

.settings-row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.settings-row-label {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.settings-row-desc {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.settings-row-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.settings-input {
  width: 80px;
  height: 32px;
  font-size: 13px;
  text-align: center;
}

.settings-unit {
  color: var(--text-muted);
  font-size: 13px;
  min-width: 24px;
}

.settings-badge {
  font-size: 12px;
}

.settings-action-btn {
  color: var(--text-primary);
}

.settings-action-btn:hover {
  background: var(--surface-active);
}

.settings-action-danger {
  color: color-mix(in srgb, var(--danger-soft) 70%, transparent);
  border-color: color-mix(in srgb, var(--danger-soft) 30%, transparent);
}

.settings-action-danger:hover {
  background: var(--danger-tint);
  border-color: color-mix(in srgb, var(--danger-soft) 40%, transparent);
}

.settings-select-group {
  display: flex;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px;
  background: var(--surface-hover);
}

.settings-select-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 100ms ease;
}

.settings-select-btn:hover {
  color: var(--text-primary);
}

.settings-select-btn[data-active="true"] {
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* === 意见反馈弹窗 === */
.feedback-dialog {
  max-width: 360px !important;
  border: 1px solid var(--card-border) !important;
  border-radius: 4px !important;
  background: var(--surface) !important;
  padding: 28px 24px 24px !important;
  box-shadow: none !important;
}

.feedback-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.feedback-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--info-tint);
  color: var(--info);
}

.feedback-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.feedback-desc {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.feedback-card {
  margin-top: 20px;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  overflow: hidden;
}

.feedback-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--card-border);
}

.feedback-info-row:last-child {
  border-bottom: none;
}

.feedback-label {
  font-size: 13px;
  color: var(--text-muted);
}

.feedback-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.feedback-email {
  font-size: 13px;
  font-weight: 600;
  color: var(--info);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 160ms ease;
}

.feedback-email:hover {
  opacity: 0.8;
  text-decoration: underline;
}

.feedback-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
