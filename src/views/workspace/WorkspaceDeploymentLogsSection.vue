<template>
  <section class="deployment-log-page">
    <WorkspaceToolbarPanel>
      <template #search>
        <div class="deployment-log-search-field">
          <Search class="deployment-log-search-icon" :size="16" />
          <InputText
            :model-value="filter.keyword"
            class="pl-[38px]"
            placeholder="搜索项目名 / 服务器..."
            @update:model-value="(v: any) => (filter.keyword = v ?? '')"
          />
        </div>
      </template>
    </WorkspaceToolbarPanel>

    <article class="deployment-log-table" aria-label="部署日志">
      <header class="deployment-log-head">
        <div class="deployment-log-cell deployment-log-date">
          <span>部署时间</span>
        </div>
        <div class="deployment-log-cell deployment-log-project">
          <span>部署项目</span>
          <Popover v-model:open="projectFilterOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="deployment-log-header-filter"
                :data-active="filter.projectId !== null"
                title="按项目筛选"
              >
                <Filter :size="12" />
              </button>
            </PopoverTrigger>
            <PopoverContent class="deployment-log-popover" align="start" :side-offset="4">
              <div class="deployment-log-popover-header">
                <span>选择项目</span>
              </div>
              <div class="deployment-log-popover-list">
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.projectId === null"
                  @click="selectProject(null)"
                >
                  全部项目
                </button>
                <button
                  v-for="project in projects"
                  :key="project.id"
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.projectId === project.id"
                  @click="selectProject(project.id)"
                >
                  {{ project.name }}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div class="deployment-log-cell deployment-log-mode">
          <span>部署方式</span>
        </div>
        <div class="deployment-log-cell deployment-log-environment">
          <span>部署环境</span>
          <Popover v-model:open="environmentFilterOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="deployment-log-header-filter"
                :data-active="filter.environmentName !== null"
                title="按环境筛选"
              >
                <Filter :size="12" />
              </button>
            </PopoverTrigger>
            <PopoverContent class="deployment-log-popover" align="start" :side-offset="4">
              <div class="deployment-log-popover-header">
                <span>选择环境</span>
              </div>
              <div class="deployment-log-popover-list">
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.environmentName === null"
                  @click="selectEnvironment(null)"
                >
                  全部环境
                </button>
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.environmentName === 'dev'"
                  @click="selectEnvironment('dev')"
                >
                  开发环境
                </button>
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.environmentName === 'test'"
                  @click="selectEnvironment('test')"
                >
                  测试环境
                </button>
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.environmentName === 'prod'"
                  @click="selectEnvironment('prod')"
                >
                  生产环境
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div class="deployment-log-cell deployment-log-server">
          <span>部署服务器</span>
        </div>
        <div class="deployment-log-cell deployment-log-result">
          <span>部署结果</span>
          <Popover v-model:open="statusFilterOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="deployment-log-header-filter"
                :data-active="filter.status !== null"
                title="按状态筛选"
              >
                <Filter :size="12" />
              </button>
            </PopoverTrigger>
            <PopoverContent class="deployment-log-popover" align="start" :side-offset="4">
              <div class="deployment-log-popover-header">
                <span>选择状态</span>
              </div>
              <div class="deployment-log-popover-list">
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.status === null"
                  @click="selectStatus(null)"
                >
                  全部状态
                </button>
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.status === 'success'"
                  @click="selectStatus('success')"
                >
                  成功
                </button>
                <button
                  type="button"
                  class="deployment-log-popover-item"
                  :data-active="filter.status === 'error'"
                  @click="selectStatus('error')"
                >
                  失败
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div class="deployment-log-action-head">操作</div>
      </header>

      <div v-if="filteredRecords.length > 0" class="deployment-log-body">
        <div v-for="record in filteredRecords" :key="record.id" class="deployment-log-row">
          <div class="deployment-log-cell deployment-log-date">
            <strong>{{ formatDate(record.finishedAt) }}</strong>
            <span>{{ formatFinishedMeta(record.finishedAt, record.durationMs) }}</span>
          </div>

          <div class="deployment-log-cell deployment-log-project">
            <strong>{{ record.projectName }}</strong>
          </div>

          <div class="deployment-log-cell deployment-log-mode">
            <Badge variant="outline" class="mode-chip" :data-mode="record.mode">{{ formatMode(record.mode) }}</Badge>
          </div>

          <div class="deployment-log-cell deployment-log-environment">
            <Badge variant="outline" class="environment-chip">{{ formatEnvironmentLabel(record.environmentName) }}</Badge>
          </div>

          <div class="deployment-log-cell deployment-log-server">
            <strong>{{ record.serverName || "未记录服务器" }}</strong>
            <span>{{ record.serverHost || record.remotePath || "无服务器信息" }}</span>
          </div>

          <div class="deployment-log-cell deployment-log-result">
            <Badge variant="outline" class="result-badge" :data-status="record.status">
              {{ record.status === "success" ? "成功" : "失败" }}
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            title="删除记录"
            aria-label="删除部署记录"
            class="deployment-log-delete"
            @click="$emit('delete-record', record.id)"
          >
            <Trash2 class="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Empty v-else-if="hasActiveFilter" class="deployment-log-empty border-0">
        <EmptyMedia>
          <Search class="deployment-log-empty-icon" :size="40" />
        </EmptyMedia>
        <EmptyContent>
          <EmptyTitle class="deployment-log-empty-title">没有匹配的记录</EmptyTitle>
          <EmptyDescription class="deployment-log-empty-desc">尝试调整筛选条件或重置筛选。</EmptyDescription>
        </EmptyContent>
      </Empty>

      <Empty v-else class="deployment-log-empty border-0">
        <EmptyMedia>
          <FileClock class="deployment-log-empty-icon" :size="40" />
        </EmptyMedia>
        <EmptyContent>
          <EmptyTitle class="deployment-log-empty-title">暂无部署日志</EmptyTitle>
          <EmptyDescription class="deployment-log-empty-desc">完成部署任务后，所有项目的部署记录会集中显示在这里。</EmptyDescription>
        </EmptyContent>
      </Empty>
    </article>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { FileClock, Filter, Search, Trash2 } from "lucide-vue-next"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import WorkspaceToolbarPanel from "@/components/workspace-header/WorkspaceToolbarPanel.vue"
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input as InputText } from "@/components/ui/input"
import Popover from "@/components/ui/popover/Popover.vue"
import PopoverContent from "@/components/ui/popover/PopoverContent.vue"
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue"
import type { ExecutionMode, TaskHistoryRecord, TaskHistoryStatus } from "@/types/task"
import type { ProjectSummary } from "@/types/project"
import { formatEnvironmentLabel } from "./formatters"
import type { DeployLogFilterState } from "./useDeployLogFilter"

defineProps<{
  records: TaskHistoryRecord[]
  projects: ProjectSummary[]
  filter: DeployLogFilterState
  filteredRecords: TaskHistoryRecord[]
  hasActiveFilter: boolean
}>()

const emit = defineEmits<{
  "delete-record": [recordId: string]
  "reset-filter": []
  "update:filter-project": [projectId: string | null]
  "update:filter-environment": [environmentName: string | null]
  "update:filter-status": [status: TaskHistoryStatus | null]
}>()

const projectFilterOpen = ref(false)
const environmentFilterOpen = ref(false)
const statusFilterOpen = ref(false)

function selectProject(projectId: string | null) {
  emit("update:filter-project", projectId)
  projectFilterOpen.value = false
}

function selectEnvironment(environmentName: string | null) {
  emit("update:filter-environment", environmentName)
  environmentFilterOpen.value = false
}

function selectStatus(status: TaskHistoryStatus | null) {
  emit("update:filter-status", status)
  statusFilterOpen.value = false
}

function formatDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatFinishedMeta(finishedAt: string, durationMs: number) {
  const finish = new Date(finishedAt)

  if (Number.isNaN(finish.getTime())) {
    return "--"
  }

  const formatter = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return `${formatter.format(finish)} · 耗时 ${formatDuration(durationMs)}`
}

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return "<1s"
  }

  if (durationMs < 1000) {
    return "<1s"
  }

  if (durationMs < 60_000) {
    return `${Math.round(durationMs / 1000)}s`
  }

  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.round((durationMs % 60_000) / 1000)

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function formatMode(mode: ExecutionMode) {
  if (mode === "deploy") {
    return "仅部署"
  }

  if (mode === "build-and-deploy") {
    return "打包 + 部署"
  }

  return "仅打包"
}
</script>

<style scoped>
.deployment-log-page {
  display: grid;
  align-content: start;
  min-width: 0;
}

.deployment-log-search-field {
  position: relative;
  width: 100%;
}

.deployment-log-search-icon {
  position: absolute;
  top: 50%;
  left: 14px;
  color: var(--text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

.deployment-log-table {
  --deployment-log-grid: minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) minmax(180px, 1.2fr) minmax(80px, 0.6fr) minmax(60px, 0.4fr);

  display: grid;
  min-width: 0;
  background: transparent;
}

/* === 空状态（与项目列表空状态保持一致） === */
.deployment-log-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 360px;
  padding: 40px;
}

.deployment-log-empty-icon {
  color: var(--text-muted);
}

.deployment-log-empty-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.deployment-log-empty-desc {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  text-align: center;
}

.deployment-log-body {
  overflow: hidden;
  display: grid;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
}

.deployment-log-head,
.deployment-log-row {
  display: grid;
  grid-template-columns: var(--deployment-log-grid);
  align-items: center;
}

.deployment-log-head {
  min-height: 54px;
  background: transparent;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
}

.deployment-log-head .deployment-log-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.deployment-log-row {
  min-height: 60px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  transition: background-color 140ms ease;
}

.deployment-log-row:last-child {
  border-bottom: 0;
}

.deployment-log-row:hover {
  background: var(--surface-hover);
}

.deployment-log-cell {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 0 18px;
}

.deployment-log-cell span {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deployment-log-cell strong {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.deployment-log-cell span {
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.deployment-log-action-head {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 18px;
  text-align: center;
  white-space: nowrap;
  justify-self: center;
}

.deployment-log-delete {
  color: var(--danger-soft);
}

.deployment-log-delete:hover {
  background: var(--danger-tint);
  color: var(--danger-soft);
}

.mode-chip {
  justify-self: start;
  font-size: 12px;
  background: var(--surface-active);
  color: var(--text-muted);
}

.mode-chip[data-mode="build-and-deploy"] {
  background: var(--info-tint);
  color: var(--info);
  border-color: rgba(0, 122, 255, 0.2);
}

.mode-chip[data-mode="deploy"] {
  background: var(--success-tint);
  color: var(--success-soft);
  border-color: rgba(48, 209, 88, 0.2);
}

.mode-chip[data-mode="build"] {
  background: var(--warning-tint);
  color: var(--warning-soft);
  border-color: rgba(255, 159, 10, 0.2);
}

.environment-chip {
  justify-self: start;
  font-size: 12px;
  background: var(--surface-active);
  color: var(--text-muted);
}

.result-badge {
  justify-self: start;
  font-size: 12px;
  font-weight: 500;
}

.result-badge[data-status="success"] {
  background: var(--success-tint);
  color: var(--success-soft);
  border-color: rgba(48, 209, 88, 0.2);
}

.result-badge[data-status="error"] {
  background: var(--danger-tint);
  color: var(--danger-soft);
  border-color: rgba(255, 59, 48, 0.2);
}

.deployment-log-mode,
.deployment-log-environment,
.deployment-log-result {
  padding-inline: 14px;
}

.deployment-log-result {
  justify-items: start;
}

.deployment-log-header-filter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 100ms ease;
}

.deployment-log-header-filter:hover {
  background: var(--surface-active);
  color: var(--text-primary);
  border-color: var(--border);
}

.deployment-log-header-filter[data-active="true"] {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: var(--surface);
}

.deployment-log-popover {
  width: 130px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.deployment-log-popover-header {
  padding: 4px 6px 2px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0;
}

.deployment-log-popover-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.deployment-log-popover-item {
  display: block;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 80ms ease;
}

.deployment-log-popover-item:hover {
  background: var(--surface-active);
}

.deployment-log-popover-item[data-active="true"] {
  background: var(--text-primary);
  color: var(--surface);
}


@media (max-width: 1180px) {
  .deployment-log-cell {
    padding-inline: 14px;
  }

  .deployment-log-action-head,
  .deployment-log-mode,
  .deployment-log-environment,
  .deployment-log-result {
    padding-inline: 10px;
  }

  .deployment-log-table {
    --deployment-log-grid: minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(80px, 0.6fr) minmax(80px, 0.6fr) minmax(150px, 1fr) minmax(70px, 0.5fr) minmax(50px, 0.3fr);
  }
}

@media (max-width: 860px) {
  .deployment-log-table {
    overflow-x: auto;
    --deployment-log-grid: minmax(140px, 1.2fr) minmax(120px, 1fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) minmax(180px, 1.2fr) minmax(80px, 0.6fr) minmax(60px, 0.4fr);
  }

  .deployment-log-head,
  .deployment-log-row {
    min-width: 980px;
  }
}
</style>
