<template>
  <div ref="widgetRef" class="deployment-progress-widget">
    <!-- 展开面板（在按钮上方） -->
    <Transition name="deploy-panel">
      <div v-if="isExpanded" class="deploy-progress-panel">
        <header class="deploy-panel-header">
          <div class="deploy-panel-title-group">
            <span class="deploy-panel-title">部署任务</span>
            <span v-if="runningCount > 0" class="deploy-panel-subtitle">{{ runningCount }} 个进行中</span>
          </div>
          <div class="deploy-panel-actions">
            <button class="deploy-panel-action-btn" title="关闭" @click="isExpanded = false">
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        <div class="deploy-panel-body">
          <!-- 当前运行中的任务 -->
          <template v-if="visibleTasks.length > 0">
            <article
              v-for="task in visibleTasks"
              :key="task.id"
              class="deploy-task-card"
              :data-stage="task.stage"
            >
              <div class="deploy-task-header">
                <div class="deploy-task-icon-wrap" :data-stage="task.stage">
                  <Loader2 v-if="task.stage === 'running'" class="h-4 w-4 deploy-spinning" />
                  <Check v-else-if="task.stage === 'success'" class="h-4 w-4" />
                  <Ban v-else-if="task.stage === 'canceled'" class="h-4 w-4" />
                  <X v-else class="h-4 w-4" />
                </div>
                <div class="deploy-task-info">
                  <p class="deploy-task-project">{{ task.projectName }}</p>
                  <p class="deploy-task-target">{{ task.environmentLabel }} · {{ task.serverName }}</p>
                </div>
                <button
                  v-if="task.stage === 'running'"
                  class="deploy-task-abort-btn"
                  title="中止部署"
                  :disabled="abortingTaskId === task.id"
                  @click="handleAbortTask(task.id)"
                >
                  <Loader2 v-if="abortingTaskId === task.id" class="h-3 w-3 deploy-spinning" />
                  <Ban v-else class="h-3 w-3" />
                </button>
                <button
                  v-else
                  class="deploy-task-dismiss-btn"
                  title="移除"
                  @click="dismissTask(task.id)"
                >
                  <X class="h-3 w-3" />
                </button>
              </div>

              <div v-if="task.stage === 'running'" class="deploy-task-progress">
                <div class="deploy-progress-track">
                  <div
                    class="deploy-progress-fill"
                    data-stage="running"
                    :style="{ width: task.progress + '%' }"
                  ></div>
                </div>
                <p class="deploy-task-stage-text">{{ task.message || getStageMessage(task.stage) }}</p>
              </div>

              <p v-if="task.stage === 'error'" class="deploy-task-message">{{ task.message || getStageMessage(task.stage) }}</p>
            </article>
          </template>

          <!-- 最近部署历史 -->
          <template v-if="historyRecords.length > 0">
            <div v-if="visibleTasks.length > 0" class="deploy-section-divider">
              <span>最近记录</span>
            </div>
            <article
              v-for="record in historyRecords"
              :key="record.id"
              class="deploy-task-card"
              :data-stage="historyStage(record.status)"
            >
              <div class="deploy-task-header">
                <div class="deploy-task-icon-wrap" :data-stage="historyStage(record.status)">
                  <Check v-if="record.status === 'success'" class="h-4 w-4" />
                  <Ban v-else-if="record.status === 'canceled'" class="h-4 w-4" />
                  <X v-else class="h-4 w-4" />
                </div>
                <div class="deploy-task-info">
                  <p class="deploy-task-project">{{ record.projectName }}</p>
                  <p class="deploy-task-target">
                    {{ formatEnvironmentLabel(record.environmentName) }}
                    <template v-if="record.serverName"> · {{ record.serverName }}</template>
                  </p>
                </div>
                <span class="deploy-task-time">{{ formatTimeAgo(record.finishedAt) }}</span>
              </div>
              <p v-if="record.status === 'error'" class="deploy-task-message">{{ record.summary }}</p>
            </article>
          </template>

          <!-- 空状态 -->
          <div v-if="visibleTasks.length === 0 && historyRecords.length === 0" class="deploy-empty">
            <Rocket class="h-6 w-6 deploy-empty-icon" />
            <p>暂无部署记录</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 悬浮圆形按钮（始终显示） -->
    <button
      class="deploy-fab"
      :data-has-running="hasRunning"
      :title="hasRunning ? `${runningCount} 个部署进行中` : '部署任务'"
      @click="togglePanel"
    >
      <Loader2 v-if="hasRunning" class="h-5 w-5 deploy-spinning" />
      <Rocket v-else class="h-5 w-5" />
      <span v-if="runningCount > 0" class="deploy-fab-badge">{{ runningCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue"
import { Ban, Check, Loader2, Rocket, X } from "lucide-vue-next"

import { getTaskHistory } from "@/services/task-history/repository"
import { useDeploymentProgress, type DeploymentTaskStage } from "@/services/ui/deployment-progress"
import { showToast } from "@/services/ui/toast"
import type { TaskHistoryRecord, TaskHistoryStatus } from "@/types/task"

const { tasks, runningCount, hasRunning, dismissTask, cancelTask } = useDeploymentProgress()

const isExpanded = ref(false)
const historyRecords = ref<TaskHistoryRecord[]>([])
const widgetRef = ref<HTMLElement | null>(null)
const abortingTaskId = ref<string | null>(null)

const visibleTasks = computed(() => tasks.filter((t) => !t.dismissed))

// 新任务启动时自动展开面板
watch(
  () => tasks.length,
  (newLen, oldLen) => {
    if (newLen > (oldLen ?? 0)) {
      isExpanded.value = true
    }
  },
)

// 面板展开时刷新历史记录
watch(isExpanded, async (expanded) => {
  if (expanded) {
    await refreshHistory()
  }
})

onMounted(async () => {
  await refreshHistory()
  document.addEventListener("mousedown", handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside)
})

function handleClickOutside(event: MouseEvent) {
  if (!isExpanded.value) return
  if (!widgetRef.value) return
  if (widgetRef.value.contains(event.target as Node)) return
  isExpanded.value = false
}

async function refreshHistory() {
  try {
    const records = await getTaskHistory()
    historyRecords.value = records.slice(0, 10)
  } catch {
    historyRecords.value = []
  }
}

function togglePanel() {
  isExpanded.value = !isExpanded.value
}

function getStageMessage(stage: string) {
  if (stage === "running") return "部署中..."
  if (stage === "success") return "部署成功"
  if (stage === "error") return "部署失败"
  if (stage === "canceled") return "部署已中止"
  return ""
}

/** 将历史记录状态映射为任务卡片 stage，用于样式与图标展示 */
function historyStage(status: TaskHistoryStatus): DeploymentTaskStage {
  if (status === "success") return "success"
  if (status === "canceled") return "canceled"
  return "error"
}

/** 中止运行中的部署任务（仅打包阶段有效） */
async function handleAbortTask(taskId: string) {
  if (abortingTaskId.value) return
  abortingTaskId.value = taskId
  try {
    const success = await cancelTask(taskId)
    if (!success) {
      showToast("任务可能已结束，无法中止", "warning")
    }
  } finally {
    // 短暂保留 loading 态，待 executeDeploy 更新 task.stage 后清除
    setTimeout(() => {
      if (abortingTaskId.value === taskId) {
        abortingTaskId.value = null
      }
    }, 1500)
  }
}

function formatEnvironmentLabel(name: string) {
  if (name === "dev") return "开发环境"
  if (name === "test") return "测试环境"
  if (name === "prod") return "生产环境"
  return "自定义环境"
}

function formatTimeAgo(dateStr: string) {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.max(now - then, 0)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString("zh-CN")
}
</script>

<style scoped>
.deployment-progress-widget {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 40;
  pointer-events: none;
}

/* === 悬浮圆形按钮 === */
.deploy-fab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: var(--foreground);
  color: var(--background);
  cursor: pointer;
  pointer-events: auto;
  transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08);
}

.deploy-fab:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16), 0 6px 20px rgba(0, 0, 0, 0.1);
}

.deploy-fab:active {
  transform: scale(0.95);
}

.deploy-fab[data-has-running="true"] {
  background: var(--info);
  color: var(--background);
}

.deploy-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--destructive);
  color: var(--background);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  border: 2px solid var(--background);
}

/* === 展开面板 === */
.deploy-progress-panel {
  position: absolute;
  bottom: 54px;
  right: 0;
  width: 340px;
  max-height: 440px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--card-border);
  border-radius: 8px;
  background: var(--surface);
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  pointer-events: auto;
}

.deploy-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--card-border);
  background: var(--surface-hover);
  flex-shrink: 0;
}

.deploy-panel-title-group {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.deploy-panel-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.deploy-panel-subtitle {
  font-size: 11px;
  color: var(--info);
  font-weight: 500;
}

.deploy-panel-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.deploy-panel-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 160ms ease;
}

.deploy-panel-action-btn:hover {
  background: var(--surface-active);
  color: var(--text-primary);
}

.deploy-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* === 分隔线 === */
.deploy-section-divider {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.deploy-section-divider::before,
.deploy-section-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--card-border);
}

.deploy-section-divider span {
  padding: 0 8px;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* === 任务卡片 === */
.deploy-task-card {
  padding: 10px 12px;
  border: 1px solid var(--card-border);
  border-radius: 6px;
  background: var(--surface);
  transition: all 160ms ease;
}

.deploy-task-card[data-stage="success"] {
  border-color: transparent;
  background: var(--success-tint);
}

.deploy-task-card[data-stage="error"] {
  border-color: transparent;
  background: var(--danger-tint);
}

.deploy-task-card[data-stage="canceled"] {
  border-color: transparent;
  background: var(--surface-active);
}

.deploy-task-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.deploy-task-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
}

.deploy-task-icon-wrap[data-stage="running"] {
  color: var(--info);
}

.deploy-task-icon-wrap[data-stage="success"] {
  color: color-mix(in srgb, var(--success-soft) 55%, transparent);
}

.deploy-task-icon-wrap[data-stage="error"] {
  color: color-mix(in srgb, var(--danger-soft) 55%, transparent);
}

.deploy-task-icon-wrap[data-stage="canceled"] {
  color: var(--text-muted);
}

.deploy-task-info {
  flex: 1;
  min-width: 0;
}

.deploy-task-project {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deploy-task-target {
  margin: 2px 0 0 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deploy-task-time {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  margin-top: 2px;
}

.deploy-task-dismiss-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 160ms ease;
}

.deploy-task-card:hover .deploy-task-dismiss-btn {
  opacity: 1;
}

.deploy-task-dismiss-btn:hover {
  background: var(--surface-active);
  color: var(--text-primary);
}

/* === 中止按钮（运行中任务显示，默认红色） === */
.deploy-task-abort-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--destructive);
  cursor: pointer;
  transition: all 160ms ease;
}

.deploy-task-abort-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--destructive) 14%, transparent);
  color: var(--destructive);
}

.deploy-task-abort-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

/* === 进度条 === */
.deploy-task-progress {
  margin-top: 8px;
}

.deploy-progress-track {
  position: relative;
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background: var(--surface-active);
  overflow: hidden;
}

.deploy-progress-fill {
  position: relative;
  height: 100%;
  border-radius: 2px;
  transition: width 600ms cubic-bezier(0.4, 0, 0.2, 1);
}

.deploy-progress-fill[data-stage="running"] {
  background: var(--info);
}

/* === 消息 === */
.deploy-task-message {
  margin: 6px 0 0 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deploy-task-card[data-stage="success"] .deploy-task-message {
  color: color-mix(in srgb, var(--success-soft) 55%, transparent);
  font-weight: 500;
}

.deploy-task-card[data-stage="error"] .deploy-task-message {
  color: color-mix(in srgb, var(--danger-soft) 55%, transparent);
  font-weight: 500;
}

.deploy-task-card[data-stage="canceled"] .deploy-task-message {
  color: var(--text-muted);
  font-weight: 500;
}

/* 运行中进度条下方的阶段文字（如"正在本地打包..."） */
.deploy-task-stage-text {
  margin: 6px 0 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* === 空状态 === */
.deploy-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--text-muted);
}

.deploy-empty p {
  margin: 0;
  font-size: 13px;
}

.deploy-empty-icon {
  opacity: 0.4;
}

/* === 旋转动画 === */
.deploy-spinning {
  animation: deploy-spin 1s linear infinite;
}

@keyframes deploy-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* === 面板弹出过渡 === */
.deploy-panel-enter-active {
  transition: opacity 180ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 180ms cubic-bezier(0.4, 0, 0.2, 1);
}

.deploy-panel-leave-active {
  transition: opacity 140ms cubic-bezier(0.4, 0, 0.2, 1),
              transform 140ms cubic-bezier(0.4, 0, 0.2, 1);
}

.deploy-panel-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}

.deploy-panel-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}
</style>
