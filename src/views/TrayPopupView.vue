<template>
  <div class="tray-glass">
    <!-- 顶部搜索栏 -->
    <header class="tray-header">
      <div class="tray-search">
        <Search class="tray-search-icon" />
        <input
          v-model="searchQuery"
          class="tray-search-input"
          type="text"
          placeholder="搜索项目"
          spellcheck="false"
        />
        <button v-if="searchQuery" class="tray-search-clear" @click="searchQuery = ''">
          <X class="h-3 w-3" />
        </button>
      </div>
      <button class="tray-header-action" title="打开主窗口" @click="openMainWindow">
        <ArrowUpRight class="h-3.5 w-3.5" />
      </button>
    </header>

    <!-- 项目列表（手风琴） -->
    <div class="tray-projects" v-if="!isLoading && projectGroups.length > 0">
      <TransitionGroup name="tray-project-list" tag="div" class="tray-projects-inner">
        <div
          v-for="group in projectGroups"
          :key="group.project.id"
          class="tray-project"
          :class="{ 'tray-project--open': expandedProjectId === group.project.id }"
        >
          <button
            class="tray-project-head"
            :class="{ 'tray-project-head--open': expandedProjectId === group.project.id }"
            @click="toggleProject(group.project.id)"
          >
            <span class="tray-project-name">{{ group.project.name }}</span>
            <span class="tray-project-count">{{ group.options.length }}</span>
            <ChevronRight
              class="tray-project-chevron"
              :class="{ 'tray-project-chevron--open': expandedProjectId === group.project.id }"
            />
          </button>
          <div
            class="tray-project-body"
            :class="{ 'tray-project-body--open': expandedProjectId === group.project.id }"
          >
            <div class="tray-project-body-inner">
              <button
                v-for="opt in group.options"
                :key="opt.environment.name"
                class="tray-env"
                :class="{ 'tray-env--deploying': isDeploying(opt) }"
                :disabled="isDeploying(opt) || isAnyDeploying"
                @click="handleDeploy(opt)"
              >
                <span class="tray-env-dot" :class="`tray-dot--${opt.environment.name}`"></span>
                <span class="tray-env-label">{{ formatEnvironmentLabel(opt.environment.name) }}</span>
                <span class="tray-env-server">{{ opt.server ? `${opt.server.host}:${opt.server.port}` : '' }}</span>
                <span class="tray-env-action">
                  <Loader2 v-if="isDeploying(opt)" class="h-3.5 w-3.5 tray-spinning" />
                  <Send v-else class="h-3.5 w-3.5" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div class="tray-projects" v-else-if="isLoading">
      <div class="tray-state">
        <Loader2 class="h-4 w-4 tray-spinning" />
        <span>加载中</span>
      </div>
    </div>

    <div class="tray-projects" v-else>
      <div class="tray-state">
        <span>{{ searchQuery ? '未找到匹配项目' : '暂无可部署项目' }}</span>
      </div>
    </div>

    <!-- 底部统一面板：进度 / 最近部署 切换 -->
    <div class="tray-bottom">
      <div class="tray-panel" :class="activeTask ? `tray-panel--${activeTask.stage}` : ''">
        <!-- 分段切换头 -->
        <div class="tray-panel-tabs">
          <button
            class="tray-tab"
            :class="{ 'tray-tab--active': bottomView === 'progress' }"
            @click="bottomView = 'progress'"
          >
            <Activity class="tray-tab-icon" />
            <span>部署</span>
            <span v-if="activeTask" class="tray-tab-dot" :class="`tray-tab-dot--${activeTask.stage}`"></span>
          </button>
          <button
            v-if="recentDeployments.length > 0"
            class="tray-tab"
            :class="{ 'tray-tab--active': bottomView === 'recent' }"
            @click="bottomView = 'recent'"
          >
            <History class="tray-tab-icon" />
            <span>最近</span>
            <span class="tray-tab-count">{{ recentDeployments.length }}</span>
          </button>
        </div>

        <!-- 内容区 -->
        <div class="tray-panel-body">
          <div ref="stageRef" class="tray-panel-stage" :style="{ height: stageHeight + 'px' }">
            <Transition name="tray-panel-switch" mode="out-in" @after-leave="measureStage">
              <div v-if="bottomView === 'progress'" ref="progressViewRef" key="progress" class="tray-panel-view tray-panel-view--absolute">
                <Transition name="tray-progress" mode="out-in" @after-enter="measureStage">
                  <div v-if="!activeTask" key="empty" class="tray-progress-empty">
                    <span>选择环境开始部署</span>
                  </div>

                  <div v-else-if="activeTask.stage === 'running'" key="running" class="tray-progress-active">
                    <div class="tray-progress-row">
                      <div class="tray-progress-title">
                        <span class="tray-progress-project">{{ activeTask.projectName }}</span>
                        <span class="tray-progress-env">{{ formatEnvironmentLabel(activeTask.environmentName) }}</span>
                      </div>
                      <span class="tray-progress-stage">{{ activeTask.message }}</span>
                    </div>
                    <div class="tray-progress-track">
                      <div class="tray-progress-fill" :style="{ width: activeTask.progress + '%' }"></div>
                    </div>
                  </div>

                  <div
                    v-else-if="activeTask.stage === 'success'"
                    key="success"
                    class="tray-progress-result tray-progress-result--success"
                  >
                    <CheckCircle2 class="tray-progress-icon" />
                    <span class="tray-progress-project">{{ activeTask.projectName }}</span>
                    <span class="tray-progress-env">{{ formatEnvironmentLabel(activeTask.environmentName) }}</span>
                    <span class="tray-progress-stage">部署成功</span>
                  </div>

                  <div
                    v-else-if="activeTask.stage === 'error'"
                    key="error"
                    class="tray-progress-result tray-progress-result--error"
                  >
                    <XCircle class="tray-progress-icon" />
                    <span class="tray-progress-project">{{ activeTask.projectName }}</span>
                    <span class="tray-progress-env">{{ formatEnvironmentLabel(activeTask.environmentName) }}</span>
                    <span class="tray-progress-stage">{{ activeTask.message || '部署失败' }}</span>
                  </div>
                </Transition>
              </div>

              <!-- 最近部署视图 -->
              <div v-else ref="recentViewRef" key="recent" class="tray-panel-view tray-panel-view--absolute tray-panel-view--recent">
                <div
                  v-for="record in recentDeployments"
                  :key="record.id"
                  class="tray-recent-item"
                >
                  <span
                    class="tray-recent-item-dot"
                    :class="record.status === 'success' ? 'tray-dot--success' : 'tray-dot--error'"
                  ></span>
                  <span class="tray-recent-item-name">{{ record.projectName }}</span>
                  <span class="tray-recent-item-env">{{ formatEnvironmentLabel(record.environmentName) }}</span>
                  <span class="tray-recent-item-time">{{ formatRelativeTime(record.finishedAt) }}</span>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from "vue"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { type UnlistenFn } from "@tauri-apps/api/event"
import { Activity, ArrowUpRight, CheckCircle2, ChevronRight, History, Loader2, Search, Send, X, XCircle } from "lucide-vue-next"
import { invoke } from "@tauri-apps/api/core"

import { loadProjects } from "@/services/storage/projects"
import { loadServers } from "@/services/storage/servers"
import { loadEnvironments } from "@/services/storage/environments"
import { runLocalBuild } from "@/services/execution/build"
import { runLocalDeploy } from "@/services/execution/deploy-local"
import { appendTaskHistory, getTaskHistory } from "@/services/task-history/repository"
import { useDeploymentProgress } from "@/services/ui/deployment-progress"
import type { ProjectRecord, ServerRecord, DeployEnvironmentRecord, TaskHistoryRecord } from "@/types/task"

interface TrayDeployOption {
  project: ProjectRecord
  environment: DeployEnvironmentRecord
  server: ServerRecord | null
}

interface ProjectGroup {
  project: ProjectRecord
  options: TrayDeployOption[]
}

const BUILD_TIMEOUT_KEY = "claw-deploy:build-timeout"
const DEPLOY_TIMEOUT_KEY = "claw-deploy:deploy-timeout"
const SSH_TIMEOUT_KEY = "claw-deploy:ssh-timeout"

function loadTimeout(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const val = parseInt(raw, 10)
      if (val > 0) return val
    }
  } catch {}
  return fallback
}

function formatEnvironmentLabel(name: string) {
  if (name === "dev") return "开发"
  if (name === "test") return "测试"
  if (name === "prod") return "生产"
  return "自定义"
}

function formatRelativeTime(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = Math.max(0, now - then)
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return "刚刚"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} 天前`
  return new Date(iso).toLocaleDateString("zh-CN")
}

const isLoading = ref(true)
const projects = ref<ProjectRecord[]>([])
const servers = ref<ServerRecord[]>([])
const environments = ref<DeployEnvironmentRecord[]>([])

const searchQuery = ref("")
const expandedProjectId = ref<string | null>(null)
const bottomView = ref<"progress" | "recent">("progress")
const recentDeployments = ref<TaskHistoryRecord[]>([])

// 面板高度自适应：用 ResizeObserver 监听视图高度变化，驱动 stage 高度过渡
const stageRef = ref<HTMLElement | null>(null)
const progressViewRef = ref<HTMLElement | null>(null)
const recentViewRef = ref<HTMLElement | null>(null)
const stageHeight = ref(68)
let resizeObserver: ResizeObserver | null = null

function measureStage() {
  nextTick(() => {
    const currentView = bottomView.value === 'progress' ? progressViewRef.value : recentViewRef.value
    if (currentView) {
      stageHeight.value = Math.max(currentView.offsetHeight, 68)
    }
  })
}

// 监听当前视图高度变化（running 中 message 变化、列表加载等）
function observeCurrentView() {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  const currentView = bottomView.value === 'progress' ? progressViewRef.value : recentViewRef.value
  if (currentView) {
    resizeObserver = new ResizeObserver(() => {
      measureStage()
    })
    resizeObserver.observe(currentView)
  }
}

const deploymentProgress = useDeploymentProgress()
const deployingProjectId = ref<string | null>(null)
const deployingEnvironmentName = ref<string | null>(null)
const activeTaskId = ref<string | null>(null)
const elapsedSeconds = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null

const activeTask = computed(() => {
  if (!activeTaskId.value) return null
  return deploymentProgress.tasks.find((t) => t.id === activeTaskId.value) ?? null
})

watch([bottomView, activeTask, recentDeployments], () => {
  measureStage()
  observeCurrentView()
})
// running 状态下 message/stage 变化时重新测量高度
watch(() => activeTask.value?.message, measureStage)
watch(() => activeTask.value?.stage, measureStage)

const isAnyDeploying = computed(() => deployingProjectId.value !== null)

const elapsedLabel = computed(() => {
  const s = elapsedSeconds.value
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
})

const projectGroups = computed<ProjectGroup[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const groups: ProjectGroup[] = []
  projects.value.forEach((project) => {
    const projectEnvs = environments.value.filter(
      (env) => env.projectId === project.id && env.enabled && (env.name === "test" || env.name === "prod")
    )
    const options: TrayDeployOption[] = []
    projectEnvs.forEach((env) => {
      const server = servers.value.find((s) => s.id === env.serverId) ?? null
      if (server && env.remotePath.trim()) {
        options.push({ project, environment: env, server })
      }
    })
    if (options.length === 0) return
    if (query && !project.name.toLowerCase().includes(query)) return
    groups.push({ project, options })
  })
  return groups
})

function toggleProject(projectId: string) {
  expandedProjectId.value = expandedProjectId.value === projectId ? null : projectId
}

function isDeploying(item: TrayDeployOption): boolean {
  return deployingProjectId.value === item.project.id && deployingEnvironmentName.value === item.environment.name
}

function startElapsedTimer() {
  elapsedSeconds.value = 0
  if (elapsedTimer) clearInterval(elapsedTimer)
  elapsedTimer = setInterval(() => {
    elapsedSeconds.value++
  }, 1000)
}

function stopElapsedTimer() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

async function loadRecentDeployments() {
  try {
    const records = await getTaskHistory()
    recentDeployments.value = records.slice(0, 5)
  } catch {}
}

async function handleDeploy(item: TrayDeployOption) {
  if (isDeploying(item) || isAnyDeploying.value) return

  const envLabel = formatEnvironmentLabel(item.environment.name)

  if (!item.project.defaultBuildCommand.trim()) return
  if (!item.project.defaultOutputDir.trim()) return
  if (!item.server) return

  deployingProjectId.value = item.project.id
  deployingEnvironmentName.value = item.environment.name

  const taskId = deploymentProgress.addTask({
    id: crypto.randomUUID(),
    projectId: item.project.id,
    projectName: item.project.name,
    environmentName: item.environment.name,
    environmentLabel: envLabel,
    serverName: item.server.name,
    serverHost: `${item.server.host}:${item.server.port}`,
    remotePath: item.environment.remotePath,
    stage: "running",
    message: "准备部署",
    progress: 5,
    startedAt: new Date().toISOString(),
    finishedAt: null,
  })

  activeTaskId.value = taskId
  bottomView.value = "progress"
  startElapsedTimer()

  const startedAt = new Date().toISOString()
  const packagePathSegment = item.project.packagePath ? `${item.project.packagePath}/` : ''
  let buildOutputPath = `${item.project.localPath}/${packagePathSegment}${item.project.defaultOutputDir}`
  let historySummary = ""
  let historyErrorMessage = ""
  let deployStatus: "success" | "error" = "error"

  try {
    if (item.environment.deployMode === "build-and-deploy") {
      deploymentProgress.updateTask(taskId, { message: "本地打包中", progress: 15 })

      const buildResult = await runLocalBuild({
        projectPath: item.project.localPath,
        buildCommand: item.project.defaultBuildCommand,
        outputDir: item.project.defaultOutputDir,
        precheckCommand: item.project.defaultPrecheckCommand,
        runPrecheck: item.project.defaultPrecheckEnabled,
        buildTimeout: loadTimeout(BUILD_TIMEOUT_KEY, 600),
        packagePath: item.project.packagePath || '',
      })

      if (!buildResult.success) {
        throw new Error(buildResult.buildOutput.trim() || "本地打包失败")
      }

      buildOutputPath = buildResult.outputPath
      deploymentProgress.updateTask(taskId, { progress: 45 })
    } else {
      deploymentProgress.updateTask(taskId, { progress: 40 })
    }

    deploymentProgress.updateTask(taskId, { message: "上传到服务器", progress: 55 })

    const deployResult = await runLocalDeploy({
      environmentName: item.environment.name,
      outputPath: buildOutputPath,
      postDeployCommand: item.environment.postDeployCommand,
      projectName: item.project.name,
      remotePath: item.environment.remotePath,
      server: item.server,
      uploadStrategy: item.environment.uploadStrategy,
      sshTimeout: loadTimeout(SSH_TIMEOUT_KEY, 20),
      deployTimeout: loadTimeout(DEPLOY_TIMEOUT_KEY, 300),
    })

    if (!deployResult.success) {
      throw new Error(deployResult.errorMessage || deployResult.commandOutput || "远端部署失败")
    }

    deploymentProgress.updateTask(taskId, { progress: 90 })

    historySummary = `部署成功，已发布到${envLabel}`
    deployStatus = "success"
    deploymentProgress.updateTask(taskId, {
      stage: "success",
      message: "部署成功",
      progress: 100,
      finishedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    historySummary = `部署失败，目标环境 ${envLabel}`
    historyErrorMessage = message
    deployStatus = "error"
    deploymentProgress.updateTask(taskId, {
      stage: "error",
      message: message,
      finishedAt: new Date().toISOString(),
    })
  } finally {
    stopElapsedTimer()

    const finishedAt = new Date().toISOString()

    await appendTaskHistory({
      id: crypto.randomUUID(),
      projectId: item.project.id,
      projectName: item.project.name,
      environmentName: item.environment.name,
      mode: item.environment.deployMode,
      status: deployStatus,
      buildCommand: item.project.defaultBuildCommand,
      outputDir: item.project.defaultOutputDir,
      outputPath: buildOutputPath,
      serverName: item.server.name,
      serverHost: `${item.server.host}:${item.server.port}`,
      remotePath: item.environment.remotePath,
      startedAt,
      finishedAt,
      durationMs: Math.max(new Date(finishedAt).getTime() - new Date(startedAt).getTime(), 0),
      summary: historySummary,
      errorMessage: historyErrorMessage || undefined,
      logs: [],
    })

    await loadRecentDeployments()

    setTimeout(() => {
      deployingProjectId.value = null
      deployingEnvironmentName.value = null
    }, 2000)
  }
}

async function openMainWindow() {
  try {
    await invoke("show_main_window")
  } catch {}
  try {
    const popup = getCurrentWindow()
    await popup.hide()
  } catch {}
}

async function loadData() {
  try {
    const [projectList, serverList, envList] = await Promise.all([
      loadProjects(),
      loadServers(),
      loadEnvironments(),
    ])
    projects.value = projectList
    servers.value = serverList
    environments.value = envList
  } catch {
    // ignore
  } finally {
    isLoading.value = false
  }
}

let unlistenShow: UnlistenFn | null = null

onMounted(async () => {
  await loadData()
  await loadRecentDeployments()
  measureStage()
  observeCurrentView()

  const win = getCurrentWindow()
  unlistenShow = await win.listen('tauri://focus', () => {
    loadData()
    loadRecentDeployments()
    if (!isAnyDeploying.value && activeTaskId.value && activeTask.value && activeTask.value.stage !== 'running') {
      deploymentProgress.removeTask(activeTaskId.value)
      activeTaskId.value = null
      elapsedSeconds.value = 0
    }
  })
})

onBeforeUnmount(() => {
  stopElapsedTimer()
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (unlistenShow) {
    unlistenShow()
    unlistenShow = null
  }
})
</script>

<style scoped>
/* === CSS 变量：浅色/深色自动切换 === */
.tray-glass {
  --text-primary: rgba(0, 0, 0, 0.88);
  --text-secondary: rgba(0, 0, 0, 0.5);
  --text-tertiary: rgba(0, 0, 0, 0.35);
  --bg-hover: rgba(0, 0, 0, 0.07);
  --bg-active: rgba(0, 0, 0, 0.12);
  --bg-card: rgba(0, 0, 0, 0.05);
  --bg-tag: rgba(0, 0, 0, 0.06);
  --border-subtle: rgba(0, 0, 0, 0.1);
  --accent: #007AFF;
  --success: #28CD41;
  --error: #FF3B30;
  --warning: #FF9F0A;
  --deploying-bg: rgba(0, 122, 255, 0.12);
  --bg-project-open: rgba(0, 122, 255, 0.06);
  --bg-progress-running: rgba(0, 122, 255, 0.08);
  --bg-result-success: rgba(40, 205, 65, 0.08);
  --bg-result-error: rgba(255, 59, 48, 0.08);
  --ease-smooth: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-out-soft: cubic-bezier(0.2, 0.9, 0.3, 1);
}

@media (prefers-color-scheme: dark) {
  .tray-glass {
    --text-primary: rgba(255, 255, 255, 0.95);
    --text-secondary: rgba(255, 255, 255, 0.55);
    --text-tertiary: rgba(255, 255, 255, 0.4);
    --bg-hover: rgba(255, 255, 255, 0.08);
    --bg-active: rgba(255, 255, 255, 0.12);
    --bg-card: rgba(255, 255, 255, 0.06);
    --bg-tag: rgba(255, 255, 255, 0.08);
    --border-subtle: rgba(255, 255, 255, 0.1);
    --accent: #0A84FF;
    --success: #30D158;
    --error: #FF453A;
    --warning: #FF9F0A;
    --deploying-bg: rgba(10, 132, 255, 0.18);
    --bg-project-open: rgba(10, 132, 255, 0.12);
    --bg-progress-running: rgba(10, 132, 255, 0.15);
    --bg-result-success: rgba(48, 209, 88, 0.12);
    --bg-result-error: rgba(255, 69, 58, 0.12);
  }
}

/* === 根容器 === */
.tray-glass {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: transparent;
  border-radius: 14px;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* === 顶部搜索栏 === */
.tray-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 12px 12px 8px;
}

.tray-search {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 1px solid var(--border-subtle);
  transition: border-color 160ms var(--ease-smooth), background 160ms var(--ease-smooth), box-shadow 160ms var(--ease-smooth);
}

.tray-search:focus-within {
  border-color: var(--accent);
  background: var(--bg-active);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
}

@media (prefers-color-scheme: dark) {
  .tray-search:focus-within {
    box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
  }
}

.tray-search-icon {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
}

.tray-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: var(--text-primary);
}

.tray-search-input::placeholder {
  color: var(--text-tertiary);
}

.tray-search-clear {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: var(--bg-active);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease;
}

.tray-search-clear:hover {
  background: var(--text-tertiary);
  color: var(--text-primary);
}

.tray-header-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 120ms var(--ease-smooth);
}

.tray-header-action:hover {
  background: var(--bg-active);
  color: var(--text-primary);
}

/* === 项目列表区域 === */
.tray-projects {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 0 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--text-tertiary) transparent;
}

.tray-projects::-webkit-scrollbar {
  width: 4px;
}

.tray-projects::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 2px;
}

.tray-projects-inner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
}

/* === 项目手风琴 === */
.tray-project {
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  transition: background-color 220ms var(--ease-smooth);
}

.tray-project--open {
  background: var(--bg-card);
}

.tray-project-head {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 120ms var(--ease-smooth);
}

.tray-project-head:hover {
  background: var(--bg-hover);
}

.tray-project-head--open {
  background: transparent;
}

.tray-project-head--open:hover {
  background: var(--bg-hover);
}

.tray-project-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.tray-project-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-tag);
}

.tray-project-chevron {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
  transition: transform 300ms var(--ease-smooth);
}

.tray-project-chevron--open {
  transform: rotate(90deg);
}

/* === 项目展开体（grid-template-rows 动画） === */
.tray-project-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 320ms var(--ease-smooth);
}

.tray-project-body--open {
  grid-template-rows: 1fr;
}

.tray-project-body-inner {
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 2px 6px 6px 6px;
  opacity: 0;
  transition: opacity 200ms ease;
}

.tray-project-body--open .tray-project-body-inner {
  opacity: 1;
  transition-delay: 100ms;
}

/* === 环境按钮 === */
.tray-env {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 120ms var(--ease-smooth);
}

.tray-env:hover:not(:disabled) {
  background: var(--bg-hover);
}

.tray-env:active:not(:disabled) {
  background: var(--bg-active);
}

.tray-env:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tray-env--deploying {
  background: var(--deploying-bg);
  opacity: 1;
}

.tray-env--deploying:disabled {
  opacity: 1;
}

.tray-env-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  transition: box-shadow 200ms var(--ease-smooth);
}

.tray-dot--test {
  background: var(--accent);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15);
}

.tray-dot--prod {
  background: var(--warning);
  box-shadow: 0 0 0 3px rgba(255, 159, 10, 0.15);
}

.tray-dot--success {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(40, 205, 65, 0.15);
}

.tray-dot--error {
  background: var(--error);
  box-shadow: 0 0 0 3px rgba(255, 59, 48, 0.15);
}

@media (prefers-color-scheme: dark) {
  .tray-dot--test {
    box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.2);
  }
  .tray-dot--prod {
    box-shadow: 0 0 0 3px rgba(255, 159, 10, 0.2);
  }
  .tray-dot--success {
    box-shadow: 0 0 0 3px rgba(48, 209, 88, 0.2);
  }
  .tray-dot--error {
    box-shadow: 0 0 0 3px rgba(255, 69, 58, 0.2);
  }
}

.tray-env-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.tray-env-server {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.tray-env-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--accent);
  opacity: 0.55;
  transition: opacity 120ms var(--ease-smooth);
}

.tray-env:hover:not(:disabled) .tray-env-action {
  opacity: 1;
}

/* === 空状态 === */
.tray-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 16px;
  color: var(--text-tertiary);
  font-size: 12px;
}

/* === 底部区域 === */
.tray-bottom {
  flex-shrink: 0;
  padding: 0 12px 12px;
}

/* === 统一面板 === */
.tray-panel {
  border-radius: 12px;
  background: var(--bg-card);
  overflow: hidden;
  transition: background-color 280ms var(--ease-smooth);
}

.tray-panel--running {
  background: var(--bg-progress-running);
}

.tray-panel--success {
  background: var(--bg-result-success);
}

.tray-panel--error {
  background: var(--bg-result-error);
}

/* === 分段切换头 === */
.tray-panel-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px;
  border-bottom: 1px solid var(--border-subtle);
}

.tray-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 8px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 7px;
  transition: background-color 140ms var(--ease-smooth), color 140ms var(--ease-smooth);
}

.tray-tab:hover:not(.tray-tab--active) {
  background: var(--bg-hover);
  color: var(--text-secondary);
}

.tray-tab--active {
  background: var(--bg-active);
  color: var(--text-primary);
}

.tray-tab-icon {
  flex-shrink: 0;
  width: 13px;
  height: 13px;
}

.tray-tab-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tray-tab-dot--running {
  background: var(--accent);
  animation: tray-pulse 1.2s ease-in-out infinite;
}

.tray-tab-dot--success {
  background: var(--success);
}

.tray-tab-dot--error {
  background: var(--error);
}

@keyframes tray-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.tray-tab-count {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-tertiary);
  padding: 0 5px;
  border-radius: 4px;
  background: var(--bg-tag);
  min-width: 16px;
  text-align: center;
}

/* === 面板内容区 === */
.tray-panel-body {
  overflow: hidden;
}

.tray-panel-stage {
  position: relative;
  min-height: 68px;
  transition: height 260ms cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.tray-panel-view {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tray-panel-view--absolute {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}

.tray-panel-view--recent {
  gap: 1px;
}

/* === 进度内容（统一高度，避免状态切换时高度跳变） === */
.tray-progress-empty,
.tray-progress-active,
.tray-progress-result {
  display: flex;
  align-items: center;
  width: 100%;
  height: 44px;
}

.tray-progress-empty {
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 12px;
}

.tray-progress-active {
  flex-direction: column;
  gap: 8px;
  align-items: stretch;
  justify-content: center;
}

.tray-progress-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tray-progress-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.tray-progress-project {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tray-progress-env {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-tag);
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  line-height: 1.5;
}

.tray-progress-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  margin-left: 8px;
}

.tray-progress-track {
  width: 100%;
  height: 3px;
  border-radius: 1.5px;
  background: var(--border-subtle);
  overflow: hidden;
}

.tray-progress-fill {
  height: 100%;
  border-radius: 1.5px;
  background: var(--accent);
  transition: width 400ms var(--ease-smooth);
  position: relative;
  overflow: hidden;
}

.tray-progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.35),
    transparent
  );
  animation: tray-progress-shimmer 1.6s linear infinite;
}

@keyframes tray-progress-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.tray-progress-stage {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  flex-shrink: 1;
  min-width: 0;
}

.tray-progress-result {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 44px;
}

.tray-progress-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.tray-progress-result--success .tray-progress-icon {
  color: var(--success);
  animation: tray-success-pop 480ms var(--ease-smooth);
}

.tray-progress-result--error .tray-progress-icon {
  color: var(--error);
  animation: tray-error-shake 360ms var(--ease-smooth);
}

.tray-progress-result--success .tray-progress-stage {
  color: var(--success);
  flex-shrink: 0;
  margin-left: auto;
}

.tray-progress-result--error .tray-progress-stage {
  color: var(--error);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  text-align: right;
}

/* === 最近部署列表项 === */
.tray-recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: 6px;
  transition: background-color 100ms ease;
}

.tray-recent-item:hover {
  background: var(--bg-hover);
}

.tray-recent-item-dot {
  flex-shrink: 0;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tray-recent-item-name {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tray-recent-item-env {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-secondary);
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-tag);
}

.tray-recent-item-time {
  flex: 1;
  text-align: right;
  font-size: 11px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* === 动画 === */
.tray-spinning {
  animation: tray-spin 0.8s linear infinite;
}

@keyframes tray-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes tray-success-pop {
  0% { transform: scale(0.5); opacity: 0; }
  55% { transform: scale(1.18); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes tray-error-shake {
  0% { transform: scale(0.8) translateX(0); opacity: 0; }
  20% { transform: scale(1) translateX(-3px); opacity: 1; }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
  100% { transform: translateX(0); }
}

/* 项目列表项进出动画 */
.tray-project-list-enter-active {
  transition: all 280ms var(--ease-out-soft);
}

.tray-project-list-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.tray-project-list-leave-active {
  transition: all 180ms ease;
  position: absolute;
}

.tray-project-list-leave-to {
  opacity: 0;
}

.tray-project-list-move {
  transition: transform 280ms var(--ease-out-soft);
}

/* 进度→结果过渡（丝滑核心） */
.tray-progress-enter-active {
  transition: opacity 420ms var(--ease-smooth), transform 420ms var(--ease-smooth);
  will-change: transform, opacity;
}

.tray-progress-leave-active {
  transition: opacity 80ms ease-out;
  will-change: opacity;
}

.tray-progress-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.tray-progress-leave-to {
  opacity: 0;
}

/* 面板视图切换：out-in 模式，离开极短，进入配合高度过渡 */
.tray-panel-switch-enter-active {
  transition: opacity 220ms cubic-bezier(0.4, 0, 0.2, 1), transform 220ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: opacity, transform;
}

.tray-panel-switch-leave-active {
  transition: opacity 80ms ease;
  will-change: opacity;
}

.tray-panel-switch-enter-from {
  opacity: 0;
  transform: translateY(4px) scale(0.99);
}

.tray-panel-switch-leave-to {
  opacity: 0;
}

/* 最近部署列表项逐条淡入，增加内容过渡丝滑感 */
.tray-panel-view--recent .tray-recent-item {
  animation: tray-recent-item-in 240ms cubic-bezier(0.4, 0, 0.2, 1) both;
}

.tray-panel-view--recent .tray-recent-item:nth-child(1) { animation-delay: 40ms; }
.tray-panel-view--recent .tray-recent-item:nth-child(2) { animation-delay: 80ms; }
.tray-panel-view--recent .tray-recent-item:nth-child(3) { animation-delay: 120ms; }
.tray-panel-view--recent .tray-recent-item:nth-child(4) { animation-delay: 160ms; }
.tray-panel-view--recent .tray-recent-item:nth-child(5) { animation-delay: 200ms; }

@keyframes tray-recent-item-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>

<style>
/* popup 窗口：html/body/#app 全部透明，让原生 vibrancy 透出 */
html.tray-popup-window,
html.tray-popup-window body,
html.tray-popup-window #app {
  background: transparent !important;
}
</style>
